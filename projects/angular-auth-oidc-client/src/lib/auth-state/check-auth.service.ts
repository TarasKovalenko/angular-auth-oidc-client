import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthStateService } from './auth-state.service';
import { AutoLoginService } from '../auto-login/auto-login.service';
import { CallbackService } from '../callback/callback.service';
import { PeriodicallyTokenCheckService } from '../callback/periodically-token-check.service';
import { RefreshSessionService } from '../callback/refresh-session.service';
import { OpenIdConfiguration } from '../config/openid-configuration';
import { CheckSessionService } from '../iframe/check-session.service';
import { SilentRenewService } from '../iframe/silent-renew.service';
import { LoggerService } from '../logging/logger.service';
import { LoginResponse } from '../login/login-response';
import { PopUpService } from '../login/popup/popup.service';
import { EventTypes } from '../public-events/event-types';
import { PublicEventsService } from '../public-events/public-events.service';
import { StoragePersistenceService } from '../storage/storage-persistence.service';
import { UserService } from '../user-data/user.service';
import { CurrentUrlService } from '../utils/url/current-url.service';

@Injectable()
export class CheckAuthService {
  constructor(
    private readonly checkSessionService: CheckSessionService,
    private readonly currentUrlService: CurrentUrlService,
    private readonly silentRenewService: SilentRenewService,
    private readonly userService: UserService,
    private readonly loggerService: LoggerService,
    private readonly authStateService: AuthStateService,
    private readonly callbackService: CallbackService,
    private readonly refreshSessionService: RefreshSessionService,
    private readonly periodicallyTokenCheckService: PeriodicallyTokenCheckService,
    private readonly popupService: PopUpService,
    private readonly autoLoginService: AutoLoginService,
    private readonly storagePersistenceService: StoragePersistenceService,
    private readonly publicEventsService: PublicEventsService
  ) {}

  checkAuth(configuration: OpenIdConfiguration, allConfigs: OpenIdConfiguration[], url?: string): Observable<LoginResponse> {
    this.publicEventsService.fireEvent(EventTypes.CheckingAuth);

    const stateParamFromUrl = this.currentUrlService.getStateParamFromCurrentUrl(url);

    if (!!stateParamFromUrl) {
      configuration = this.getConfigurationWithUrlState([configuration], stateParamFromUrl);

      if (!configuration) {
        return throwError(() => new Error(`could not find matching config for state ${stateParamFromUrl}`));
      }
    }

    return this.checkAuthWithConfig(configuration, allConfigs, url);
  }

  checkAuthMultiple(allConfigs: OpenIdConfiguration[], url?: string): Observable<LoginResponse[]> {
    const stateParamFromUrl = this.currentUrlService.getStateParamFromCurrentUrl(url);

    if (stateParamFromUrl) {
      const config = this.getConfigurationWithUrlState(allConfigs, stateParamFromUrl);

      if (!config) {
        return throwError(() => new Error(`could not find matching config for state ${stateParamFromUrl}`));
      }

      return this.composeMultipleLoginResults(allConfigs, config, url);
    }

    const configs = allConfigs;
    const allChecks$ = configs.map((x) => this.checkAuthWithConfig(x, configs, url));

    return forkJoin(allChecks$);
  }

  checkAuthIncludingServer(configuration: OpenIdConfiguration, allConfigs: OpenIdConfiguration[]): Observable<LoginResponse> {
    return this.checkAuthWithConfig(configuration, allConfigs).pipe(
      switchMap((loginResponse) => {
        const { isAuthenticated } = loginResponse;

        if (isAuthenticated) {
          return of(loginResponse);
        }

        return this.refreshSessionService.forceRefreshSession(configuration, allConfigs).pipe(
          tap((loginResponseAfterRefreshSession) => {
            if (loginResponseAfterRefreshSession?.isAuthenticated) {
              this.startCheckSessionAndValidation(configuration, allConfigs);
            }
          })
        );
      })
    );
  }

  private checkAuthWithConfig(config: OpenIdConfiguration, allConfigs: OpenIdConfiguration[], url?: string): Observable<LoginResponse> {
    if (!config) {
      const errorMessage = 'Please provide at least one configuration before setting up the module';

      this.loggerService.logError(config, errorMessage);

      return of({ isAuthenticated: false, errorMessage, userData: null, idToken: null, accessToken: null, configId: null });
    }

    const currentUrl = url || this.currentUrlService.getCurrentUrl();
    const { configId, authority } = config;

    this.loggerService.logDebug(config, `Working with config '${configId}' using ${authority}`);

    if (this.popupService.currentWindowIsPopUp()) {
      this.popupService.sendMessageToMainWindow(currentUrl);

      return of(null);
    }

    const isCallback = this.callbackService.isCallback(currentUrl);

    this.loggerService.logDebug(config, 'currentUrl to check auth with: ', currentUrl);

    const callback$ = isCallback ? this.callbackService.handleCallbackAndFireEvents(currentUrl, config, allConfigs) : of(null);

    return callback$.pipe(
      map(() => {
        const isAuthenticated = this.authStateService.areAuthStorageTokensValid(config);

        if (isAuthenticated) {
          this.startCheckSessionAndValidation(config, allConfigs);

          if (!isCallback) {
            this.authStateService.setAuthenticatedAndFireEvent(allConfigs);
            this.userService.publishUserDataIfExists(config, allConfigs);
          }
        }

        this.loggerService.logDebug(config, 'checkAuth completed - firing events now. isAuthenticated: ' + isAuthenticated);

        return {
          isAuthenticated,
          userData: this.userService.getUserDataFromStore(config),
          accessToken: this.authStateService.getAccessToken(config),
          idToken: this.authStateService.getIdToken(config),
          configId,
        };
      }),
      tap(({ isAuthenticated }) => {
        this.publicEventsService.fireEvent(EventTypes.CheckingAuthFinished);

        if (isAuthenticated) {
          this.autoLoginService.checkSavedRedirectRouteAndNavigate(config);
        }
      }),
      catchError(({ message }) => {
        this.loggerService.logError(config, message);
        this.publicEventsService.fireEvent(EventTypes.CheckingAuthFinishedWithError, message);

        return of({ isAuthenticated: false, errorMessage: message, userData: null, idToken: null, accessToken: null, configId });
      })
    );
  }

  private startCheckSessionAndValidation(config: OpenIdConfiguration, allConfigs: OpenIdConfiguration[]): void {
    if (this.checkSessionService.isCheckSessionConfigured(config)) {
      this.checkSessionService.start(config);
    }

    this.periodicallyTokenCheckService.startTokenValidationPeriodically(allConfigs, config);

    if (this.silentRenewService.isSilentRenewConfigured(config)) {
      this.silentRenewService.getOrCreateIframe(config);
    }
  }

  private getConfigurationWithUrlState(configurations: OpenIdConfiguration[], stateFromUrl: string): OpenIdConfiguration {
    for (const config of configurations) {
      const storedState = this.storagePersistenceService.read('authStateControl', config);

      if (storedState === stateFromUrl) {
        return config;
      }
    }

    return null;
  }

  private composeMultipleLoginResults(
    configurations: OpenIdConfiguration[],
    activeConfig: OpenIdConfiguration,
    url?: string
  ): Observable<LoginResponse[]> {
    const allOtherConfigs = configurations.filter((x) => x.configId !== activeConfig.configId);

    const currentConfigResult = this.checkAuthWithConfig(activeConfig, configurations, url);

    const allOtherConfigResults = allOtherConfigs.map((config) => {
      const { redirectUrl } = config;

      return this.checkAuthWithConfig(config, configurations, redirectUrl);
    });

    return forkJoin([currentConfigResult, ...allOtherConfigResults]);
  }
}

import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { InjectionToken, ModuleWithProviders, NgModule, Provider } from '@angular/core';
import { DataService } from './api/data.service';
import { HttpBaseService } from './api/http-base.service';
import { AuthStateService } from './auth-state/auth-state.service';
import { CheckAuthService } from './auth-state/check-auth.service';
import { AutoLoginService } from './auto-login/auto-login.service';
import { ImplicitFlowCallbackService } from './callback/implicit-flow-callback.service';
import { AuthWellKnownDataService } from './config/auth-well-known/auth-well-known-data.service';
import { AuthWellKnownService } from './config/auth-well-known/auth-well-known.service';
import { ConfigurationService } from './config/config.service';
import { StsConfigLoader, StsConfigStaticLoader } from './config/loader/config-loader';
import { OpenIdConfiguration } from './config/openid-configuration';
import { ConfigValidationService } from './config/validation/config-validation.service';
import { JwkExtractor } from './extractors/jwk.extractor';
import { CodeFlowCallbackHandlerService } from './flows/callback-handling/code-flow-callback-handler.service';
import { HistoryJwtKeysCallbackHandlerService } from './flows/callback-handling/history-jwt-keys-callback-handler.service';
import { ImplicitFlowCallbackHandlerService } from './flows/callback-handling/implicit-flow-callback-handler.service';
import { RefreshSessionCallbackHandlerService } from './flows/callback-handling/refresh-session-callback-handler.service';
import { RefreshTokenCallbackHandlerService } from './flows/callback-handling/refresh-token-callback-handler.service';
import { StateValidationCallbackHandlerService } from './flows/callback-handling/state-validation-callback-handler.service';
import { UserCallbackHandlerService } from './flows/callback-handling/user-callback-handler.service';
import { FlowsDataService } from './flows/flows-data.service';
import { FlowsService } from './flows/flows.service';
import { RandomService } from './flows/random/random.service';
import { ResetAuthDataService } from './flows/reset-auth-data.service';
import { SigninKeyDataService } from './flows/signin-key-data.service';
import { CheckSessionService } from './iframe/check-session.service';
import { IFrameService } from './iframe/existing-iframe.service';
import { SilentRenewService } from './iframe/silent-renew.service';
import { ClosestMatchingRouteService } from './interceptor/closest-matching-route.service';
import { AbstractLoggerService } from './logging/abstract-logger.service';
import { ConsoleLoggerService } from './logging/console-logger.service';
import { LoggerService } from './logging/logger.service';
import { LoginService } from './login/login.service';
import { ParLoginService } from './login/par/par-login.service';
import { ParService } from './login/par/par.service';
import { PopUpLoginService } from './login/popup/popup-login.service';
import { ResponseTypeValidationService } from './login/response-type-validation/response-type-validation.service';
import { StandardLoginService } from './login/standard/standard-login.service';
import { LogoffRevocationService } from './logoff-revoke/logoff-revocation.service';
import { OidcSecurityService } from './oidc.security.service';
import { PublicEventsService } from './public-events/public-events.service';
import { AbstractSecurityStorage } from './storage/abstract-security-storage';
import { BrowserStorageService } from './storage/browser-storage.service';
import { DefaultSessionStorageService } from './storage/default-sessionstorage.service';
import { StoragePersistenceService } from './storage/storage-persistence.service';
import { UserService } from './user-data/user.service';
import { CryptoService } from './utils/crypto/crypto.service';
import { EqualityService } from './utils/equality/equality.service';
import { FlowHelper } from './utils/flowHelper/flow-helper.service';
import { PlatformProvider } from './utils/platform-provider/platform.provider';
import { TokenHelperService } from './utils/tokenHelper/token-helper.service';
import { CurrentUrlService } from './utils/url/current-url.service';
import { UrlService } from './utils/url/url.service';
import { JwkWindowCryptoService } from './validation/jwk-window-crypto.service';
import { JwtWindowCryptoService } from './validation/jwt-window-crypto.service';
import { StateValidationService } from './validation/state-validation.service';
import { TokenValidationService } from './validation/token-validation.service';

export interface PassedInitialConfig {
  config?: OpenIdConfiguration | OpenIdConfiguration[];
  loader?: Provider;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createStaticLoader(passedConfig: PassedInitialConfig) {
  return new StsConfigStaticLoader(passedConfig.config);
}

export const PASSED_CONFIG = new InjectionToken<PassedInitialConfig>('PASSED_CONFIG');

@NgModule({
  imports: [CommonModule, HttpClientModule],
  declarations: [],
  exports: [],
})
export class AuthModule {
  static forRoot(passedConfig: PassedInitialConfig): ModuleWithProviders<AuthModule> {
    return {
      ngModule: AuthModule,
      providers: [
        // Make the PASSED_CONFIG available through injection
        { provide: PASSED_CONFIG, useValue: passedConfig },

        // Create the loader: Either the one getting passed or a static one
        passedConfig?.loader || { provide: StsConfigLoader, useFactory: createStaticLoader, deps: [PASSED_CONFIG] },
        ConfigurationService,
        PublicEventsService,
        FlowHelper,
        OidcSecurityService,
        TokenValidationService,
        PlatformProvider,
        CheckSessionService,
        FlowsDataService,
        FlowsService,
        SilentRenewService,
        LogoffRevocationService,
        UserService,
        RandomService,
        HttpBaseService,
        UrlService,
        AuthStateService,
        SigninKeyDataService,
        StoragePersistenceService,
        TokenHelperService,
        IFrameService,
        EqualityService,
        LoginService,
        ParService,
        AuthWellKnownDataService,
        AuthWellKnownService,
        DataService,
        StateValidationService,
        ConfigValidationService,
        CheckAuthService,
        ResetAuthDataService,
        ImplicitFlowCallbackService,
        HistoryJwtKeysCallbackHandlerService,
        ResponseTypeValidationService,
        UserCallbackHandlerService,
        StateValidationCallbackHandlerService,
        RefreshSessionCallbackHandlerService,
        RefreshTokenCallbackHandlerService,
        CodeFlowCallbackHandlerService,
        ImplicitFlowCallbackHandlerService,
        ParLoginService,
        PopUpLoginService,
        StandardLoginService,
        AutoLoginService,
        JwkExtractor,
        JwkWindowCryptoService,
        JwtWindowCryptoService,
        CurrentUrlService,
        ClosestMatchingRouteService,
        DefaultSessionStorageService,
        BrowserStorageService,
        CryptoService,
        LoggerService,

        { provide: AbstractSecurityStorage, useClass: DefaultSessionStorageService },
        { provide: AbstractLoggerService, useClass: ConsoleLoggerService },
      ],
    };
  }
}

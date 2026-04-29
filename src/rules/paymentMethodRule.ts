import { PaymentMethod } from '../domain/enums.js'
import { TariffConfig, TariffPaymentMethodConfig } from '../domain/tariff.js'

export function getPaymentMethodConfig(
  tariffConfig: TariffConfig,
  paymentMethod: PaymentMethod
): TariffPaymentMethodConfig {
  return tariffConfig.paymentMethods[paymentMethod]
}

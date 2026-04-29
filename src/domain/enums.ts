export enum TransportMode {
  METRO = 'metro',
  MCK = 'mck',
  MGT = 'mgt',
  CPPK = 'cppk',
  MTPPK = 'mtppk'
}

export enum PaymentMethod {
  BANK_CARD = 'bank_card',
  SBP = 'sbp',
  VIRTUAL_TROIKA = 'virtual_troika',
  FACE_PAY = 'face_pay'
}

export enum Carrier {
  METRO = 'metro',
  MCK = 'mck',
  MGT = 'mgt',
  CPPK = 'cppk',
  MTPPK = 'mtppk'
}

export enum Zone {
  MOSCOW = 'moscow',
  MOSCOW_REGION = 'moscow_region',
  UNKNOWN = 'unknown'
}

export enum ValidationEventType {
  ENTRY = 'entry',
  EXIT = 'exit',
  ONBOARD = 'onboard'
}

export enum ValidationStatus {
  ACCEPTED = 'accepted',
  DECLINED = 'declined'
}

export enum CppkValidationType {
  ENTRY = 0,
  EXIT = 1,
  DP_NORMAL_EXIT_COMPLETION = 2,
  FORCED_TRIP_COMPLETION_EXIT = 3,
  CPPK_TRAIN_SURCHARGE_7000 = 4,
  FAR_SUBURBAN_AUTO_COMPLETION = 5,
  SYNTHETIC_ENTRY = 6
}

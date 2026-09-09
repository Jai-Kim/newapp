// Manual mock (Jest auto-applies anything in the root __mocks__ dir for a
// node_modules package — no explicit jest.mock() call needed, same as
// __mocks__/@gorhom/bottom-sheet.ts). react-native-purchases is a native
// module with no JS fallback, so it can't run inside Jest unmocked.

const mockCustomerInfo = { entitlements: { active: {} } };

const Purchases = {
  configure: jest.fn(),
  logIn: jest.fn(async () => ({ customerInfo: mockCustomerInfo, created: false })),
  logOut: jest.fn(async () => mockCustomerInfo),
  getCustomerInfo: jest.fn(async () => mockCustomerInfo),
  getOfferings: jest.fn(async () => ({ current: null, all: {} })),
  purchasePackage: jest.fn(async () => ({ customerInfo: mockCustomerInfo })),
  restorePurchases: jest.fn(async () => mockCustomerInfo),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
  setLogLevel: jest.fn(),
};

export const LOG_LEVEL = {
  VERBOSE: 'VERBOSE',
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

export const PACKAGE_TYPE = {
  UNKNOWN: 'UNKNOWN',
  CUSTOM: 'CUSTOM',
  LIFETIME: 'LIFETIME',
  ANNUAL: 'ANNUAL',
  SIX_MONTH: 'SIX_MONTH',
  THREE_MONTH: 'THREE_MONTH',
  TWO_MONTH: 'TWO_MONTH',
  MONTHLY: 'MONTHLY',
  WEEKLY: 'WEEKLY',
};

export default Purchases;

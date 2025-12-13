import { addDays, addYears, format } from 'date-fns';
import type { ContractFormData } from '../pages/contracts-page.js';
import type { CustomerFormData } from '../pages/customers-page.js';

export interface PerformanceObligationTestData {
  description: string;
  allocatedPrice: string;
  recognitionMethod: 'over_time' | 'point_in_time';
  measurementMethod?: 'input' | 'output';
  percentComplete?: string;
}

export interface BillingScheduleTestData {
  billingDate: string;
  dueDate: string;
  amount: string;
  currency: string;
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'semi_annually' | 'annually';
}

export interface ExchangeRateTestData {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveDate: string;
  source: string;
}

export class TestDataGenerator {
  private counter: number = 0;

  /**
   * Generate a unique ID
   */
  private uniqueId(): string {
    return `${Date.now()}${++this.counter}`;
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Pick a random item from an array
   */
  private randomFrom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Generate a random boolean
   */
  private randomBool(probability: number = 0.5): boolean {
    return Math.random() < probability;
  }

  /**
   * Format number as currency string
   */
  private formatCurrency(amount: number): string {
    return amount.toFixed(2);
  }

  /**
   * Generate a realistic company name
   */
  private generateCompanyName(): string {
    const prefixes = ['Global', 'Advanced', 'Premier', 'Digital', 'Tech', 'Smart', 'Innovative', 'Dynamic', 'Enterprise', 'Strategic'];
    const cores = ['Solutions', 'Systems', 'Services', 'Industries', 'Corp', 'Group', 'Holdings', 'Partners', 'Ventures', 'Labs'];
    const suffixes = ['Inc', 'LLC', 'Ltd', 'SA', 'GmbH', ''];
    
    const prefix = this.randomFrom(prefixes);
    const core = this.randomFrom(cores);
    const suffix = this.randomFrom(suffixes);
    
    return `${prefix} ${core}${suffix ? ` ${suffix}` : ''}`.trim();
  }

  /**
   * Generate a tax ID based on country
   */
  private generateTaxId(country: string): string {
    switch (country) {
      case 'Brazil':
        // CNPJ format: XX.XXX.XXX/XXXX-XX
        return `${this.randomInt(10, 99)}.${this.randomInt(100, 999)}.${this.randomInt(100, 999)}/0001-${this.randomInt(10, 99)}`;
      case 'USA':
        // EIN format: XX-XXXXXXX
        return `${this.randomInt(10, 99)}-${this.randomInt(1000000, 9999999)}`;
      case 'UK':
        // VAT format: GB XXX XXXX XX
        return `GB ${this.randomInt(100, 999)} ${this.randomInt(1000, 9999)} ${this.randomInt(10, 99)}`;
      default:
        return `TAX-${this.randomInt(100000000, 999999999)}`;
    }
  }

  /**
   * Generate a phone number based on country
   */
  private generatePhone(country: string): string {
    switch (country) {
      case 'Brazil':
        return `+55 11 ${this.randomInt(90000, 99999)}-${this.randomInt(1000, 9999)}`;
      case 'USA':
        return `+1 (${this.randomInt(200, 999)}) ${this.randomInt(200, 999)}-${this.randomInt(1000, 9999)}`;
      case 'UK':
        return `+44 ${this.randomInt(1000, 9999)} ${this.randomInt(100000, 999999)}`;
      default:
        return `+${this.randomInt(1, 99)} ${this.randomInt(100, 999)} ${this.randomInt(1000000, 9999999)}`;
    }
  }

  /**
   * Generate test customer data
   */
  generateCustomer(overrides?: Partial<CustomerFormData>): CustomerFormData {
    const countries = ['USA', 'Brazil', 'UK', 'Germany', 'France', 'Japan'];
    const currencies = ['USD', 'BRL', 'EUR', 'GBP'];
    const creditRatings = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B'];
    
    const country = overrides?.country || this.randomFrom(countries);
    const currency = country === 'Brazil' ? 'BRL' : 
                     country === 'UK' ? 'GBP' : 
                     country === 'Germany' || country === 'France' ? 'EUR' : 'USD';

    return {
      name: overrides?.name || `${this.generateCompanyName()} ${this.uniqueId().slice(-4)}`,
      country,
      currency: overrides?.currency || currency,
      taxId: overrides?.taxId || this.generateTaxId(country),
      contactEmail: overrides?.contactEmail || `contact.${this.uniqueId()}@example.com`,
      contactPhone: overrides?.contactPhone || this.generatePhone(country),
      creditRating: overrides?.creditRating || this.randomFrom(creditRatings),
      billingAddress: overrides?.billingAddress || `${this.randomInt(100, 9999)} Main Street, ${country}`,
    };
  }

  /**
   * Generate test contract data
   */
  generateContract(customerId: string, overrides?: Partial<ContractFormData>): ContractFormData {
    const currencies = ['USD', 'EUR', 'GBP', 'BRL'];
    const paymentTermsList = [
      'Net 30',
      'Net 60',
      'Net 90',
      '50% upfront, 50% on delivery',
      '30% upfront, 70% upon completion',
      'Monthly installments',
      'Quarterly payments',
    ];
    
    const contractTypes = [
      'Software License Agreement',
      'SaaS Subscription',
      'Implementation Services',
      'Support and Maintenance',
      'Professional Services',
      'Consulting Agreement',
      'Development Contract',
    ];

    const startDate = new Date();
    const endDate = addYears(startDate, this.randomInt(1, 5));
    const totalValue = this.randomInt(10000, 1000000);

    return {
      customerId,
      contractNumber: overrides?.contractNumber || `CTR-${format(new Date(), 'yyyy')}-${this.uniqueId().slice(-6)}`,
      title: overrides?.title || `${this.randomFrom(contractTypes)} ${this.uniqueId().slice(-4)}`,
      startDate: overrides?.startDate || format(startDate, 'yyyy-MM-dd'),
      endDate: overrides?.endDate || format(endDate, 'yyyy-MM-dd'),
      totalValue: overrides?.totalValue || this.formatCurrency(totalValue),
      currency: overrides?.currency || this.randomFrom(currencies),
      paymentTerms: overrides?.paymentTerms || this.randomFrom(paymentTermsList),
    };
  }

  /**
   * Generate performance obligation test data
   */
  generatePerformanceObligation(contractValue: number, index: number = 0): PerformanceObligationTestData {
    const descriptions = [
      'Software License',
      'Implementation Services',
      'Training Services',
      'Support and Maintenance',
      'Customization Services',
      'Data Migration',
      'Consulting Hours',
      'Hardware Delivery',
    ];

    const recognitionMethod = this.randomFrom(['over_time', 'point_in_time'] as const);
    const measurementMethod = recognitionMethod === 'over_time' 
      ? this.randomFrom(['input', 'output'] as const)
      : undefined;

    // Allocate a portion of contract value
    const portion = this.randomInt(10, 40) / 100;
    const allocatedPrice = Math.floor(contractValue * portion);

    return {
      description: `${descriptions[index % descriptions.length]} - PO${index + 1}`,
      allocatedPrice: this.formatCurrency(allocatedPrice),
      recognitionMethod,
      measurementMethod,
      percentComplete: recognitionMethod === 'over_time' 
        ? String(this.randomInt(0, 100))
        : undefined,
    };
  }

  /**
   * Generate multiple performance obligations for a contract
   */
  generatePerformanceObligations(contractValue: number, count: number = 3): PerformanceObligationTestData[] {
    const obligations: PerformanceObligationTestData[] = [];
    let remainingValue = contractValue;

    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const portion = isLast ? 1 : this.randomInt(20, 40) / 100;
      const allocatedValue = isLast ? remainingValue : Math.floor(contractValue * portion);
      remainingValue -= allocatedValue;

      const po = this.generatePerformanceObligation(allocatedValue, i);
      po.allocatedPrice = this.formatCurrency(allocatedValue);
      obligations.push(po);
    }

    return obligations;
  }

  /**
   * Generate billing schedule test data
   */
  generateBillingSchedule(
    contractStartDate: Date,
    amount: number,
    currency: string = 'USD'
  ): BillingScheduleTestData {
    const frequencies = ['one_time', 'monthly', 'quarterly', 'semi_annually', 'annually'] as const;
    const frequency = this.randomFrom(frequencies);
    
    const billingDate = addDays(contractStartDate, this.randomInt(0, 30));
    const dueDate = addDays(billingDate, 30);

    return {
      billingDate: format(billingDate, 'yyyy-MM-dd'),
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      amount: this.formatCurrency(amount),
      currency,
      frequency,
    };
  }

  /**
   * Generate exchange rate test data
   */
  generateExchangeRate(overrides?: Partial<ExchangeRateTestData>): ExchangeRateTestData {
    const currencies = ['USD', 'EUR', 'GBP', 'BRL', 'JPY', 'CAD', 'AUD'];
    const sources = ['Reuters', 'Bloomberg', 'ECB', 'Fed', 'Manual'];

    let fromCurrency = overrides?.fromCurrency || this.randomFrom(currencies);
    let toCurrency = overrides?.toCurrency || this.randomFrom(currencies.filter(c => c !== fromCurrency));

    // Generate realistic rates
    const baseRates: Record<string, number> = {
      'USD_EUR': 0.92,
      'USD_GBP': 0.79,
      'USD_BRL': 4.97,
      'USD_JPY': 149.5,
      'EUR_USD': 1.09,
      'EUR_BRL': 5.41,
      'GBP_USD': 1.27,
      'BRL_USD': 0.20,
    };

    const key = `${fromCurrency}_${toCurrency}`;
    const baseRate = baseRates[key] || (1 / (baseRates[`${toCurrency}_${fromCurrency}`] || 1));
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const rate = baseRate * (1 + variation);

    return {
      fromCurrency,
      toCurrency,
      rate: rate.toFixed(6),
      effectiveDate: overrides?.effectiveDate || format(new Date(), 'yyyy-MM-dd'),
      source: overrides?.source || this.randomFrom(sources),
    };
  }

  /**
   * Generate a complete test dataset
   */
  generateTestDataset(options?: {
    customerCount?: number;
    contractsPerCustomer?: number;
    obligationsPerContract?: number;
  }): {
    customers: CustomerFormData[];
    contracts: Array<{ customer: CustomerFormData; contract: ContractFormData; obligations: PerformanceObligationTestData[] }>;
  } {
    const customerCount = options?.customerCount || 3;
    const contractsPerCustomer = options?.contractsPerCustomer || 2;
    const obligationsPerContract = options?.obligationsPerContract || 3;

    const customers: CustomerFormData[] = [];
    const contracts: Array<{ customer: CustomerFormData; contract: ContractFormData; obligations: PerformanceObligationTestData[] }> = [];

    for (let i = 0; i < customerCount; i++) {
      const customer = this.generateCustomer();
      customers.push(customer);

      for (let j = 0; j < contractsPerCustomer; j++) {
        const contract = this.generateContract(`customer_${i}`);
        const contractValue = parseFloat(contract.totalValue);
        const obligations = this.generatePerformanceObligations(contractValue, obligationsPerContract);

        contracts.push({
          customer,
          contract,
          obligations,
        });
      }
    }

    return { customers, contracts };
  }

  /**
   * Generate login credentials
   */
  generateCredentials(): { email: string; password: string } {
    return {
      email: `test.user.${this.uniqueId()}@example.com`,
      password: `Test@${this.uniqueId().slice(-8)}!`,
    };
  }

  /**
   * Reset counter (useful between test runs)
   */
  reset(): void {
    this.counter = 0;
  }
}

export default TestDataGenerator;

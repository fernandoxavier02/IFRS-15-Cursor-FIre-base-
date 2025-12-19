/**
 * Mock Stripe SDK for testing
 */

export const mockStripeSubscription = {
  id: 'sub_test123',
  items: {
    data: [
      {
        id: 'si_test123',
        quantity: 5,
        price: {
          id: 'price_test123',
          unit_amount: 10000,
        },
      },
    ],
  },
  status: 'active',
  customer: 'cus_test123',
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
};

export const mockStripeUpdateSubscription = jest.fn(async (subscriptionId: string, params: any) => {
  const currentQuantity = mockStripeSubscription.items.data[0].quantity;
  const newQuantity = params.items[0].quantity;
  
  return {
    ...mockStripeSubscription,
    id: subscriptionId,
    items: {
      data: [
        {
          ...mockStripeSubscription.items.data[0],
          quantity: newQuantity,
        },
      ],
    },
  };
});

export const mockStripeRetrieveSubscription = jest.fn(async (subscriptionId: string) => {
  if (subscriptionId === 'sub_notfound') {
    throw new Error('No such subscription');
  }
  return mockStripeSubscription;
});

const Stripe = jest.fn().mockImplementation(() => ({
  subscriptions: {
    retrieve: mockStripeRetrieveSubscription,
    update: mockStripeUpdateSubscription,
  },
}));

export default Stripe;

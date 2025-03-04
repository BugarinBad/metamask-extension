const { strict: assert } = require('assert');
const {
  convertToHexValue,
  withFixtures,
  logInWithBalanceValidation,
  openActionMenuAndStartSendFlow,
} = require('../helpers');
const FixtureBuilder = require('../fixture-builder');

describe('Gas API fallback', function () {
  async function mockGasApiDown(mockServer) {
    await mockServer
      .forGet(
        'https://gas-api.metaswap.codefi.network/networks/1337/suggestedGasFees',
      )
      .always()
      .thenCallback(() => {
        return {
          statusCode: 200,
          json: {
            low: {
              minWaitTimeEstimate: 180000,
              maxWaitTimeEstimate: 300000,
              suggestedMaxPriorityFeePerGas: '3',
              suggestedMaxFeePerGas: '53',
            },
            medium: {
              minWaitTimeEstimate: 15000,
              maxWaitTimeEstimate: 60000,
              suggestedMaxPriorityFeePerGas: '7',
              suggestedMaxFeePerGas: '70',
            },
            high: {
              minWaitTimeEstimate: 0,
              maxWaitTimeEstimate: 15000,
              suggestedMaxPriorityFeePerGas: '10',
              suggestedMaxFeePerGas: '100',
            },
            estimatedBaseFee: '50',
            networkCongestion: 0.9,
            latestPriorityFeeRange: ['1', '20'],
            historicalPriorityFeeRange: ['2', '125'],
            historicalBaseFeeRange: ['50', '100'],
            priorityFeeTrend: 'up',
            baseFeeTrend: 'down',
          },
        };
      });
  }

  const ganacheOptions = {
    hardfork: 'london',
    accounts: [
      {
        secretKey:
          '0x7C9529A67102755B7E6102D6D950AC5D5863C98713805CEC576B945B15B71EAC',
        balance: convertToHexValue(25000000000000000000),
      },
    ],
  };

  it('network error message is displayed if network is congested', async function () {
    await withFixtures(
      {
        fixtures: new FixtureBuilder().build(),
        testSpecificMock: mockGasApiDown,
        ganacheOptions,
        title: this.test.title,
      },
      async ({ driver, ganacheServer }) => {
        await driver.navigate();
        await logInWithBalanceValidation(driver, ganacheServer);

        await openActionMenuAndStartSendFlow(driver);
        if (process.env.MULTICHAIN) {
          return;
        }
        await driver.fill(
          'input[placeholder="Enter public address (0x) or ENS name"]',
          '0x2f318C334780961FB129D2a6c30D0763d9a5C970',
        );

        const inputAmount = await driver.findElement('.unit-input__input');
        await inputAmount.fill('1');

        await driver.clickElement({ text: 'Next', tag: 'button' });

        await driver.findElement('.transaction-alerts');

        const error = await driver.isElementPresent({
          text: 'Network is busy. Gas prices are high and estimates are less accurate.',
        });

        assert.equal(error, true, 'Network error is present');
      },
    );
  });
});

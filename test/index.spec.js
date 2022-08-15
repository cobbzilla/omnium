require('dotenv').config();

const { expect, should } = require('chai')

const { omnium, DEFAULT_TTL } = require('../index.js')

const DRIVER_CONFIG = {
    'godaddy': {
        key: process.env.GD_KEY,
        secret: process.env.GD_SECRET,
        domain: process.env.GD_DOMAIN
    },
    'route53': {
        key: process.env.ROUTE53_KEY,
        secret: process.env.ROUTE53_SECRET,
        domain: process.env.ROUTE53_DOMAIN,
        opts: { region: process.env.ROUTE53_REGION }
    }
}

// To test a single driver:
//  - Uncomment the line below to set the driverName to whichever you want to test
//  - Comment out the next `for` line and its closing curly brace just before EOF

// const driverName = 'godaddy'

for (const driverName of Object.keys(DRIVER_CONFIG)) {
    describe(`${driverName} test`, () => {
        describe(`${driverName} - create api client`, () => {
            it("should validate the config and return an API object", async () => {
                const config = DRIVER_CONFIG[driverName]
                const api = await omnium(driverName, config.key, config.secret, config.opts)
                should().exist(api, 'expected API object to exist')
            })
        })

        describe(`${driverName} - get records for domain`, () => {
            it("should return at least one DNS record", async () => {
                const config = DRIVER_CONFIG[driverName]
                const api = await omnium(driverName, config.key, config.secret, config.opts)
                const records = await api.list(config.domain)
                expect(records).to.have.lengthOf.greaterThanOrEqual(1, `expected at least one DNS record for test domain ${config.domain}`)
            })
        })

        describe(`${driverName} - add and remove a DNS record to a domain`, async () => {
            const recordSuffix = '' + Date.now()
            console.log(`${driverName}: using recordSuffix = ${recordSuffix}`)
            const config = DRIVER_CONFIG[driverName]
            let fixture
            beforeEach((done) => {
                const type = 'TXT'
                const name = `test_record_${recordSuffix}`
                omnium(driverName, config.key, config.secret, config.opts)
                    .then(api => {
                        fixture = {api, type, name}
                        done()
                    })
            })
            it("should add a DNS record", async () => {
                const response = await fixture.api.add(config.domain, fixture.type, fixture.name, DEFAULT_TTL, 'test record; index.spec.js; please delete')
                should().exist(response, 'expected response to add call to exist')
            })
            it("should find the DNS record we just added", async () => {
                const records = await fixture.api.list(config.domain, fixture.type, fixture.name)
                expect(records).to.have.lengthOf(1)
                should().exist(fixture.api,
                    `expected exactly one DNS record to match the record we just created;
                domain=${config.domain}, type=${fixture.type}, name=${fixture.name}`)

            })
            it("should remove the DNS record that was just added", async () => {
                const response = await fixture.api.remove(config.domain, fixture.type, fixture.name)
                should().exist(response, 'expected response to remove call to exist')
            })
            it("should NOT find the DNS record we added, because we just removed it", async () => {
                const records = await fixture.api.list(config.domain, fixture.type, fixture.name)
                expect(records).to.have.lengthOf(0)
                should().exist(fixture.api,
                    `expected zero DNS records to match the record we just removed;
                domain=${config.domain}, type=${fixture.type}, name=${fixture.name}`)

            })
        })
    })
}

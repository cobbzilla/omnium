const {OmniumError, ensureFqdn, removeFqdn, DEFAULT_TTL} = require('../../index')

const {
    Route53Client,
    ListHostedZonesCommand,
    ListResourceRecordSetsCommand,
    ChangeResourceRecordSetsCommand
} = require('@aws-sdk/client-route-53')

const DEFAULT_REGION = 'us-east-1'

class ApiClient {
    client
    hostedZoneIds = null
    constructor(key, secret, opts) {
        if (!key || !secret) {
            throw new OmniumError('key and secret are required')
        }
        const region = opts.region || DEFAULT_REGION
        const credentials = {
            accessKeyId: key,
            secretAccessKey: secret
        }
        this.client = new Route53Client({region, credentials})
    }
    async loadHostedZones () {
        const response = await this.client.send(new ListHostedZonesCommand({}))
        console.log(`loadHostedZones: received: ${JSON.stringify(response, null, 2)}`)
        if (response.HostedZones) {
            this.hostedZoneIds = {}
            for (const zone of response.HostedZones) {
                const name = zone.Name
                const domain = name.endsWith('.') ? name.substring(0, name.length - 1) : name
                this.hostedZoneIds[domain] = zone.Id
            }
        }
        return this.hostedZoneIds
    }
    async findHostedZoneId (domain) {
        if (!this.hostedZoneIds) {
            await this.loadHostedZones()
        }
        return this.hostedZoneIds[domain]
    }
    async testConfig () {
        return await this.loadHostedZones()
    }
    async list (domain, type = '', name = '', limit = Infinity) {
        const zoneId = await this.findHostedZoneId(domain)
        const response = await this.client.send(new ListResourceRecordSetsCommand({HostedZoneId: zoneId}))
        const records = []
        console.log(`list: response is ${JSON.stringify(response, null, 2)}`)
        if (response.ResourceRecordSets) {
            for (const record of response.ResourceRecordSets) {
                const rec = {
                    name: removeFqdn(domain, record.Name),
                    type: record.Type,
                    ttl: record.TTL
                }
                if (record.Weight) {
                    rec.data = { weight: record.Weight }
                }
                if (record.ResourceRecords) {
                    rec.values = []
                    for (const rr of record.ResourceRecords) {
                        rec.values.push(rr.Value)
                    }
                } else if (record.AliasTarget) {
                    rec.values = [record.AliasTarget.DNSName]
                }
                if (rec.values && rec.values.length === 1) {
                    rec.value = rec.values[0]
                }
                records.push(rec)
            }
        }
        return records.filter(r => (type ? r.type === type : true) && (name ? r.name === name : true) )
    }

    // if type is TXT, ensure value is enclosed in double-quotes
    formatData (type, data) {
        return type === 'TXT'
            ? data.startsWith('"') && data.endsWith('"')
                ? data
                : `"${data}"`
            : data
    }

    async add (domain, type, name, ttl = DEFAULT_TTL, data = null) {
        const zoneId = await this.findHostedZoneId(domain)
        // Route53 record names are dot-terminated FQDNs
        const awsName = ensureFqdn(domain, name) + '.'
        const opts = {
            HostedZoneId: zoneId,
            ChangeBatch: {
                Changes: [{
                    Action: 'CREATE',
                    ResourceRecordSet: {
                        Name: awsName,
                        Type: type,
                        TTL: ttl,
                        ResourceRecords: [{
                            Value: this.formatData(type, data)
                        }]
                    }
                }]
            }
        }
        const response = await this.client.send(new ChangeResourceRecordSetsCommand(opts))
        return (response.ChangeInfo && response.ChangeInfo.Status) === 'PENDING'
    }
    async remove (domain, type, name) {
        const zoneId = await this.findHostedZoneId(domain)
        const listResponse = await this.client.send(new ListResourceRecordSetsCommand({HostedZoneId: zoneId}))
        if (!listResponse.ResourceRecordSets) {
            throw new OmniumError(`record with type/name ${type}/${name} not found in domain ${domain}`)
        }
        const match = listResponse.ResourceRecordSets
            .filter(r => r.Type === type && r.Name === name + '.' + domain + '.')
        if (match.length !== 1) {
            throw new OmniumError(`More than one record with type/name ${type}/${name} found in domain ${domain}`)
        }
        const opts = {
            HostedZoneId: zoneId,
            ChangeBatch: {
                Changes: [{
                    Action: 'DELETE',
                    ResourceRecordSet: match[0]
                }]
            }
        }
        const response = await this.client.send(new ChangeResourceRecordSetsCommand(opts))
        return response.ChangeInfo
        // if (response.ChangeInfo) {
        //
        // }
    }
}

function apiClient (key, secret, opts) {
    return new ApiClient(key, secret, opts)
}

module.exports = {apiClient}

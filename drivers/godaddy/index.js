const {OmniumError, DEFAULT_TTL} = require('../../index')
const fetch = require('node-fetch-commonjs')

const GODADDY_API_URL = 'https://api.godaddy.com'

function domainRecords (domain) {
    return `/v1/domains/${domain}/records`
}

class ApiClient {
    headers
    baseURL
    constructor(key, secret, baseURL = GODADDY_API_URL) {
        if (!key || !secret) {
            throw new OmniumError('key and secret are required')
        }
        this.headers = { Authorization: `sso-key ${key}:${secret}` }
        this.baseURL = baseURL
    }
    async testConfig () {
        return (await this._request('/v1/domains', { limit: 1 })).length > 0
    }
    async _request (url, opts) {
        const method = opts.method || 'GET'
        const body = opts.body ? JSON.stringify(opts.body) : null
        const headers = opts.headers
            ? Object.assign({}, this.headers, opts.headers)
            : body
                ? Object.assign({}, this.headers, { 'Content-Type': 'application/json' })
                : this.headers
        const limitClause = opts.limit && opts.limit !== Infinity ? `?limit=${opts.limit}` : ''

        const request = body
            ? { method, headers, body }
            : { method, headers }
        return await fetch(GODADDY_API_URL + url + limitClause, request)
            .then(async (res) => {
                if ((method === 'DELETE' && res.status !== 204) ||
                    (method !== 'DELETE' && res.status !== 200)) {
                    throw new OmniumError(`_request(${url}) failed with status ${res.status}: ${res.text()}`)
                }
                const text = await res.text()
                console.log(`received response from ${url}: ${JSON.stringify(res)}, status=${res.status}, text=${text}`)
                return text ? JSON.parse(text) : {}
            })
    }
    async list (domain, type = '', name = '', limit = Infinity) {
        // if name is defined, type must also be defined
        if (name && !type) {
            throw new OmniumError(`records: name was ${name} but type not defined`)
        }
        const url = `${domainRecords(domain)}${type ? `/${type}` : ''}${name ? `/${name}` : ''}`
        const opts = { limit }
        const records = await this._request(url, opts)
        console.log(`records: got records: ${JSON.stringify(records)}`)
        return records
    }
    async add (domain, type, name, ttl = DEFAULT_TTL, data = null) {
        if (!domain || !type || !name) {
            throw new OmniumError('add: domain, type and name are required')
        }
        const url = domainRecords(domain)
        const record = { name, type }
        if (ttl) {
            record.ttl = ttl
        }
        if (data) {
            record.data = data
        }
        const opts = { method: 'PATCH', body: [record] }
        const response = await this._request(url, opts)
        console.log(`add: received response: ${response}`)
        return response
    }
    async remove (domain, type, name) {
        if (!domain || !type || !name) {
            throw new OmniumError('remove: domain, type and name are required')
        }
        const url = `${domainRecords(domain)}/${type}/${name}`
        const opts = { method: 'DELETE' }
        const response = await this._request(url, opts)
        console.log(`remove: received response: ${response}`)
        return response
    }
}

function apiClient (key, secret, opts) {
    return new ApiClient(key, secret)
}

module.exports = {apiClient}

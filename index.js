// adapted from https://stackoverflow.com/a/27724419
function OmniumError (message) {
    this.message = `${message}`
    // Use V8's native method if available, otherwise fallback
    if ('captureStackTrace' in Error) {
        Error.captureStackTrace(this, TypeError)
    } else {
        this.stack = (new Error(this.message)).stack
    }
}

async function omnium (driverPath, key, secret, opts) {
    const driver = require(driverPath.includes('/') ? driverPath : `./drivers/${driverPath}/index.js`)
    const client = driver.apiClient(key, secret, opts)
    if (!(await client.testConfig())) {
        throw new OmniumError(`omnium(${driverPath}) error: test API call failed`)
    }
    return client
}

function ensureFqdn (domain, name) {
    return name.endsWith(domain + '.')
        ? name.substring(name.length - 1)
        : name.endsWith(domain)
            ? name
            : name + '.' + domain
}

function removeFqdn (domain, name) {
    return name.endsWith('.' + domain + '.')
        ? name.substring(0, name.length - (domain.length + 2))
        : name.endsWith('.' + domain)
            ? name.substring(0, name.length - (domain.length + 1))
            : name
}
const DEFAULT_TTL = 60 * 60 // 1 hour default TTL

module.exports = { omnium, OmniumError, ensureFqdn, removeFqdn, DEFAULT_TTL }

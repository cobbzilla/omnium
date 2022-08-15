Omnium
======

Omnium is a JavaScript abstraction layer across cloud DNS services.

It supports apps that are agnostic to cloud DNS services.

# Using cloud DNS services
    const { omnium } = require('omnium')
    const godaddy = await omnium('godaddy', godaddy_key, godaddy_secret)
    const route53 = await omnium('route53', aws_key, aws_secret, {region: 'us-east-1'})

    // list DNS records for a domain
    route53.list('www.example.com')  // --> returns an array of DNS record objects

    // add a DNS record
    route53.add('www.example.com', 'A', 'some-hostname', '192.168.0.1')

    // remove a DNS record
    route53.remove('www.example.com', 'A', 'some-hostname')

    // The above commands work identically if 'route53' is replace with godaddy

# Driver Interface
A driver is any JS file that exports an 'apiClient' function like this:

    function apiClient (key, secret, opts)

* key: your API key
* secret: your API secret
* opts: depends on the driver
  * For GoDaddy, this can be omitted
  * For Route53, the 'region' property can be specified (default is us-east-1)

The object that the apiClient function returns must support these functions:

    // Find DNS records that match the given domain, type (if provided) and name (if provided)
    async list (domain, type = '', name = '')
    
    // Add a DNS record to a domain with the specified TTL
    async add (domain, type, name, ttl, data = null)
    
    // Remove a DNS record from a domain
    async remove (domain, type, name)

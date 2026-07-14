const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Array relations: Model Model[]
schema = schema.replace(/(\s+)User(\s+User\[\])/g, '$1users$2');
schema = schema.replace(/(\s+)Channel(\s+Channel\[\])/g, '$1channels$2');
schema = schema.replace(/(\s+)Client(\s+Client\[\])/g, '$1clients$2');
schema = schema.replace(/(\s+)SupplyPoint(\s+SupplyPoint\[\])/g, '$1supplyPoints$2');
schema = schema.replace(/(\s+)Contract(\s+Contract\[\])/g, '$1contracts$2');
schema = schema.replace(/(\s+)Invoice(\s+Invoice\[\])/g, '$1invoices$2');
schema = schema.replace(/(\s+)Commission(\s+Commission\[\])/g, '$1commissions$2');
schema = schema.replace(/(\s+)Brand(\s+Brand\[\])/g, '$1brands$2');
schema = schema.replace(/(\s+)Company(\s+Company\[\])/g, '$1companies$2');
schema = schema.replace(/(\s+)Lead(\s+Lead\[\])/g, '$1leads$2');
schema = schema.replace(/(\s+)SolarQuote(\s+SolarQuote\[\])/g, '$1solarQuotes$2');
schema = schema.replace(/(\s+)Ticket(\s+Ticket\[\])/g, '$1tickets$2');
schema = schema.replace(/(\s+)Document(\s+Document\[\])/g, '$1documents$2');

// Special array relations
schema = schema.replace(/(\s+)other_Invoice(\s+Invoice\[\])/g, '$1otherInvoices$2');
schema = schema.replace(/(\s+)Brand_BackofficeBrands(\s+Brand\[\])/g, '$1assignedBrands$2');

// Single relations: Model Model? or Model Model
schema = schema.replace(/(\s+)User(\s+User\??(\s+@relation|$))/g, '$1user$2');
schema = schema.replace(/(\s+)Channel(\s+Channel\??(\s+@relation|$))/g, '$1channel$2');
schema = schema.replace(/(\s+)Client(\s+Client\??(\s+@relation|$))/g, '$1client$2');
schema = schema.replace(/(\s+)SupplyPoint(\s+SupplyPoint\??(\s+@relation|$))/g, '$1supplyPoint$2');
schema = schema.replace(/(\s+)Contract(\s+Contract\??(\s+@relation|$))/g, '$1contract$2');
schema = schema.replace(/(\s+)Invoice(\s+Invoice\??(\s+@relation|$))/g, '$1invoice$2');
schema = schema.replace(/(\s+)Commission(\s+Commission\??(\s+@relation|$))/g, '$1commission$2');
schema = schema.replace(/(\s+)Brand(\s+Brand\??(\s+@relation|$))/g, '$1brand$2');
schema = schema.replace(/(\s+)Company(\s+Company\??(\s+@relation|$))/g, '$1company$2');
schema = schema.replace(/(\s+)Lead(\s+Lead\??(\s+@relation|$))/g, '$1lead$2');
schema = schema.replace(/(\s+)SolarQuote(\s+SolarQuote\??(\s+@relation|$))/g, '$1solarQuote$2');
schema = schema.replace(/(\s+)Ticket(\s+Ticket\??(\s+@relation|$))/g, '$1ticket$2');
schema = schema.replace(/(\s+)Document(\s+Document\??(\s+@relation|$))/g, '$1document$2');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema relations renamed.');

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const uuid = { type: 'string', format: 'uuid' };
const text = { type: 'string' };
const date = { type: 'string', format: 'date-time' };
const decimal = { type: 'string', description: 'Exact decimal serialized as a string; trailing zeroes may be omitted.' };
const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });
const json = (schema: unknown) => ({ 'application/json': { schema } });
const response = (description: string, schema: unknown) => ({ description, content: json(schema) });
const body = (schema: unknown) => ({ required: true, content: json(schema) });
const errorResponses = Object.fromEntries([400, 401, 403, 404, 409, 500].map((status) => [status, response({ 400: 'Invalid request or related record', 401: 'Missing/invalid token, inactive user/company, or failed login', 403: 'Missing permission or foreign company resource', 404: 'Not found', 409: 'Duplicate record', 500: 'Unexpected server error' }[status]!, ref('Error'))]));
const idParameter = { name: 'id', in: 'path', required: true, schema: uuid };
const customerInput = object({ name: text, shopName: text, phone: text, area: text, address: text, latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 }, preferredVisitTime: text, balance: { ...decimal, description: 'Requires customers:balance in addition to customers:write.' } }, ['name', 'shopName', 'latitude', 'longitude']);
const productInput = object({ name: text, sku: text, unit: text, price: { oneOf: [decimal, { type: 'number' }] }, description: text }, ['name', 'sku', 'unit', 'price']);
const customer = object({ ...customerInput.properties, id: uuid, companyId: uuid, latitude: decimal, longitude: decimal, balance: decimal, isActive: { type: 'boolean' }, createdAt: date, updatedAt: date }, ['id', 'companyId', 'name', 'shopName', 'latitude', 'longitude', 'balance', 'isActive']);
const product = object({ ...productInput.properties, id: uuid, companyId: uuid, price: decimal, isActive: { type: 'boolean' }, createdAt: date, updatedAt: date }, ['id', 'companyId', 'name', 'sku', 'price', 'unit', 'isActive']);
function operation(summary: string, permission: string | undefined, schema: unknown, status = '200', extra: Record<string, unknown> = {}) {
  return { summary, ...(permission ? { 'x-permission': permission } : {}), responses: { ...errorResponses, [status]: response('Success', schema) }, ...extra };
}
function crud(resource: 'customers' | 'products', model: string) {
  const item = resource === 'customers' ? 'customer' : 'product';
  return {
    [`/api/v1/${resource}`]: {
      get: operation(`List active ${resource} in the current company`, `${resource}:read`, object({ [resource]: { type: 'array', items: ref(model) } }, [resource])),
      post: operation(`Create ${item}`, `${resource}:write`, object({ [item]: ref(model) }, [item]), '201', { requestBody: body(ref(`${model}Input`)) }),
    },
    [`/api/v1/${resource}/{id}`]: {
      parameters: [idParameter],
      get: operation(`Get ${item}`, `${resource}:read`, object({ [item]: ref(model) }, [item])),
      put: operation(`Partially update ${item}`, `${resource}:write`, object({ [item]: ref(model) }, [item]), '200', { requestBody: body(ref(`${model}Update`)) }),
      delete: { summary: `Soft-delete ${item}`, 'x-permission': `${resource}:delete`, responses: { ...errorResponses, '204': { description: 'Soft-deleted; no response body' } } },
    },
  };
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: { title: 'DARB API', version: '1.0.0', description: 'Implemented backend endpoints. Permissions are resolved from active server-side users and company-scoped grants.' },
  servers: [{ url: '/' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: object({ error: text }, ['error']),
      Company: object({ id: uuid, slug: text, name: text, legalName: { ...text, nullable: true }, timezone: text, isActive: { type: 'boolean' }, createdAt: date, updatedAt: date }, ['id', 'slug', 'name']),
      User: object({ id: uuid, companyId: uuid, email: { type: 'string', format: 'email' }, firstName: text, lastName: text, fullName: text, phone: { ...text, nullable: true }, role: text }, ['id', 'companyId', 'email', 'firstName', 'lastName']),
      Login: object({ email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, companySlug: { type: 'string', description: 'Required when an email exists in more than one company.' } }, ['email', 'password']),
      CustomerInput: customerInput, CustomerUpdate: { ...customerInput, required: [] }, Customer: customer,
      ProductInput: productInput, ProductUpdate: { ...productInput, required: [] }, Product: product,
      OrderItemInput: object({ productId: uuid, quantity: { type: 'number', exclusiveMinimum: true, minimum: 0 }, unitPrice: { oneOf: [{ type: 'string', pattern: '^\\d+(\\.\\d{1,2})?$' }, { type: 'number', minimum: 0, multipleOf: 0.01 }] } }, ['productId', 'quantity', 'unitPrice']),
      OrderItem: object({ id: uuid, orderId: uuid, productId: uuid, quantity: decimal, unitPrice: decimal, lineTotal: decimal, createdAt: date }, ['id', 'productId', 'quantity', 'unitPrice', 'lineTotal']),
      Order: object({ id: uuid, companyId: uuid, customerId: uuid, repId: uuid, orderNumber: text, status: { type: 'string', enum: ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'] }, source: text, total: decimal, notes: { ...text, nullable: true }, items: { type: 'array', items: ref('OrderItem') }, customer: ref('Customer'), createdAt: date, updatedAt: date }, ['id', 'companyId', 'customerId', 'items', 'total', 'status']),
      IncidentInput: object({ checkpointId: uuid, incidentType: text, description: text, latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 }, severity: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' } }, ['incidentType', 'description', 'latitude', 'longitude']),
      Incident: object({ id: uuid, companyId: uuid, checkpointId: { ...uuid, nullable: true }, incidentType: text, description: text, latitude: decimal, longitude: decimal, severity: text, status: text, createdAt: date, updatedAt: date }, ['id', 'companyId', 'incidentType', 'description']),
      NearbyCheckpoint: object({ id: uuid, name: text, latitude: { type: 'number' }, longitude: { type: 'number' }, status: { type: 'string', enum: ['open', 'closed', 'crowded'] }, distance_m: { type: 'number' } }, ['id', 'name', 'latitude', 'longitude', 'status', 'distance_m']),
    },
  },
  paths: {
    '/health': { get: operation('Application liveness', undefined, object({ ok: { type: 'boolean' }, service: text, timestamp: date }, ['ok', 'service', 'timestamp']), '200', { security: [] }) },
    '/ready': { get: operation('Real PostgreSQL and Redis readiness', undefined, object({ ready: { type: 'boolean' }, database: text, redis: text }), '200', { security: [], responses: { '200': response('Dependencies available', object({ ready: { type: 'boolean' }, database: text, redis: text })), '503': response('Dependency unavailable', object({ ready: { type: 'boolean' }, error: text })) } }) },
    '/api/v1/auth/login': { post: operation('Log in an active user in an active company', undefined, object({ token: text, user: ref('User'), company: ref('Company') }, ['token', 'user', 'company']), '200', { security: [], requestBody: body(ref('Login')) }) },
    '/api/v1/auth/me': { get: operation('Get the active authenticated user', undefined, object({ user: ref('User'), company: ref('Company') }, ['user', 'company'])) },
    '/api/v1/companies/current': { get: operation('Get current company', 'company:read', object({ company: ref('Company') }, ['company'])) },
    ...crud('customers', 'Customer'), ...crud('products', 'Product'),
    '/api/v1/orders': {
      get: operation('List current company orders with items and customer', 'orders:read', object({ orders: { type: 'array', items: ref('Order') } }, ['orders'])),
      post: operation('Create an order atomically; invalid/foreign/inactive products return 400', 'orders:create', object({ order: ref('Order') }, ['order']), '201', { requestBody: body(object({ customerId: uuid, items: { type: 'array', minItems: 1, items: ref('OrderItemInput') }, notes: text }, ['customerId', 'items'])) }),
    },
    '/api/v1/orders/{id}': { parameters: [idParameter], get: operation('Get order with items and customer', 'orders:read', object({ order: ref('Order') }, ['order'])) },
    '/api/v1/checkpoints/nearby': { get: operation('Find company checkpoints using real PostGIS distances in meters', 'checkpoints:read', object({ checkpoints: { type: 'array', items: ref('NearbyCheckpoint') } }, ['checkpoints']), '200', { parameters: [
      { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
      { name: 'lng', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
      { name: 'radiusM', in: 'query', schema: { type: 'number', minimum: 10, maximum: 50000, default: 5000 } },
    ] }) },
    '/api/v1/checkpoints/reports': { post: operation('Create incident; checkpoint must belong to current company', 'incidents:create', object({ incident: ref('Incident') }, ['incident']), '201', { requestBody: body(ref('IncidentInput')) }) },
    '/openapi.json': { get: { summary: 'OpenAPI document', security: [], responses: { '200': response('OpenAPI 3 document', { type: 'object' }) } } },
    '/docs/': { get: { summary: 'Swagger UI', security: [], responses: { '200': { description: 'Swagger UI HTML', content: { 'text/html': { schema: text } } } } } },
  },
};

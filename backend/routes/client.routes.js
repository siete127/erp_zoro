const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const clientRecurringProductsController = require('../controllers/clientRecurringProductsController');
const authMiddleware = require('../middleware/authMiddleware');

// Meta: allowed status values
router.get('/meta', authMiddleware, clientController.meta);

// CRUD
router.get('/', authMiddleware, clientController.list);
router.get('/:id', authMiddleware, clientController.get);
// PATCH /api/clients/:id/active - activar/desactivar (usa Status)
router.patch('/:id/active', authMiddleware, clientController.toggleActive);
router.post('/', authMiddleware, clientController.create);
router.put('/:id', authMiddleware, clientController.update);
router.delete('/:id', authMiddleware, clientController.remove);

// Addresses
router.get('/:id/addresses', authMiddleware, clientController.listAddresses);
router.post('/:id/addresses', authMiddleware, clientController.createAddress);
router.put('/:id/addresses/:addressId', authMiddleware, clientController.updateAddress);
router.delete('/:id/addresses/:addressId', authMiddleware, clientController.removeAddress);

// Contacts
router.get('/:id/contacts', authMiddleware, clientController.listContacts);
router.post('/:id/contacts', authMiddleware, clientController.createContact);
router.put('/:id/contacts/:contactId', authMiddleware, clientController.updateContact);
router.delete('/:id/contacts/:contactId', authMiddleware, clientController.removeContact);

// Financial
router.get('/:id/financial', authMiddleware, clientController.getFinancial);
router.put('/:id/financial', authMiddleware, clientController.upsertFinancial);

// Recurring Products
router.get('/:id/recurring-products', authMiddleware, clientRecurringProductsController.getRecurringProducts);
router.post('/:id/recurring-products', authMiddleware, clientRecurringProductsController.addRecurringProduct);
router.delete('/:id/recurring-products/:productId', authMiddleware, clientRecurringProductsController.removeRecurringProduct);

module.exports = router;

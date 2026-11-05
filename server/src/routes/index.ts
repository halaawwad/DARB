import { Router } from 'express';
import authRouter from './auth.js';
import companiesRouter from './companies.js';
import customersRouter from './customers.js';
import productsRouter from './products.js';
import ordersRouter from './orders.js';
import checkpointsRouter from './checkpoints.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/companies', companiesRouter);
router.use('/customers', customersRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/checkpoints', checkpointsRouter);

export default router;

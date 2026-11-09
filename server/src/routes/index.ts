import { Router } from 'express';
import authRouter from './auth.js';
import companiesRouter from './companies.js';
import customersRouter from './customers.js';
import productsRouter from './products.js';
import ordersRouter from './orders.js';
import checkpointsRouter from './checkpoints.js';
import usersRouter from './users.js';
import rolesRouter from './roles.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/companies', companiesRouter);
router.use('/customers', customersRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/checkpoints', checkpointsRouter);
router.use('/users', usersRouter);
router.use('/roles', rolesRouter);




export default router;

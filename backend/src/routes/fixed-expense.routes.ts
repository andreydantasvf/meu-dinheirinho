import { Router } from 'express';
import { fixedExpenseController } from '../controllers/fixed-expense.controller';
import { requireAuth } from '../middlewares/require-auth';

const router = Router();

router.use(requireAuth);

router.get('/', fixedExpenseController.list);
router.get('/:id', fixedExpenseController.get);
router.post('/', fixedExpenseController.create);
router.delete('/:id', fixedExpenseController.remove);

export { router as fixedExpenseRouter };

import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller';

export const reportsRoutes = Router();

reportsRoutes.get('/dashboard', reportsController.dashboard);
reportsRoutes.get('/extrato', reportsController.extrato);
reportsRoutes.get('/accounts/:id/fatura', reportsController.fatura);

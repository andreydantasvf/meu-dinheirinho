import { app } from './app';
import { env } from './config/env';
import { startFixedExpenseJob } from './jobs/fixed-expense.job';

app.listen(env.PORT, () => {
  console.log(`Servidor rodando em http://localhost:${env.PORT}`);
  startFixedExpenseJob();
});

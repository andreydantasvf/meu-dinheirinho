-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL,
    "recorrencia" TEXT NOT NULL,
    "dia_do_mes" INTEGER,
    "data_unica" DATETIME,
    "horario" TEXT NOT NULL DEFAULT '09:00',
    "dias_antecedencia" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "proximo_disparo" DATETIME,
    "ultimo_disparo" DATETIME,
    "fixed_expense_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reminders_fixed_expense_id_fkey" FOREIGN KEY ("fixed_expense_id") REFERENCES "fixed_expenses" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "reminders_ativo_proximo_disparo_idx" ON "reminders"("ativo", "proximo_disparo");

-- CreateIndex
CREATE INDEX "reminders_fixed_expense_id_idx" ON "reminders"("fixed_expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

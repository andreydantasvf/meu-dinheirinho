// Equivalente ao AppError do backend: status + mensagem que o error-handler devolveria.
export class DemoHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Onde o Zod do backend rejeitaria o body/query → 400 "Dados inválidos".
export function invalid(): DemoHttpError {
  return new DemoHttpError(400, 'Dados inválidos');
}

// Onde o backend violaria uma foreign key (ex.: criar lançamento com conta/categoria
// inexistente) → 500 genérico, ver docs/api.md. Excluir conta/categoria em uso é 409.
export function internalError(): DemoHttpError {
  return new DemoHttpError(500, 'Internal server error');
}

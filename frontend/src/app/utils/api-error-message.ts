import { HttpErrorResponse } from '@angular/common/http';

export function formatApiError(error: unknown, fallback = 'Erro ao contactar a API.'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message;
    }
    if (error.status === 0) {
      return 'Sem ligação à API. Verifique a URL, a rede e o certificado SSL.';
    }
    if (error.status === 404) {
      return 'Endpoint não encontrado no servidor. Atualize e reinicie o backend (rotas de kiosk/check-in).';
    }
    if (error.status === 502 || error.status === 504) {
      return 'Backend indisponível. Confirme se o Node está em execução na porta 3000.';
    }
    return `Erro HTTP ${error.status}${error.statusText ? ` (${error.statusText})` : ''}.`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

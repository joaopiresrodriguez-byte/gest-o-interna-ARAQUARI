export function useToast() {
  function mostrarToast(
    mensagem: string,
    tipo: 'sucesso' | 'erro' = 'sucesso'
  ) {
    const el = document.createElement('div');
    el.textContent = mensagem;
    el.style.cssText = `
      position:fixed;
      bottom:24px;
      right:24px;
      padding:12px 20px;
      background:${tipo === 'sucesso' ? '#166534' : '#991b1b'};
      color:white;
      border-radius:8px;
      font-size:14px;
      font-weight:bold;
      z-index:9999;
      box-shadow:0 4px 20px rgba(0,0,0,0.2);
      animation:fadeIn 0.3s ease;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  return { mostrarToast };
}

# Sistema de Gestão Interna - CBMSC Araquari

Sistema web moderno desenvolvido para a gestão interna do Corpo de Bombeiros Militar de Santa Catarina (CBMSC) em Araquari. O projeto visa centralizar avisos, controle operacional, pessoal (B1), instrução (B3), logística (B4), relações públicas (B5) e o módulo SSCI.

## 🚀 Funcionalidades

- **Avisos**: Mural de notificações e comunicados internos.
- **Operacional**: Gestão de conferências diárias e logs de serviço.
- **SSCI**: Assistente Técnico com inteligência artificial para análise de normas.
- **Módulos B1-B5**: Gestão especializada para cada seção administrativa.
- **Autenticação**: Controle de acesso seguro integrado com Supabase.
- **Integração AI**: Uso do Google Gemini para assistência e análise de dados.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, Vite, TypeScript.
- **Estilização**: Tailwind CSS.
- **Backend & Auth**: Supabase.
- **AI**: Google Generative AI (Gemini).
- **Roteamento**: React Router Dom.

## 📦 Configuração e Instalação

### Pré-requisitos

- Node.js (versão LTS recomendada)
- NPM ou Yarn

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone [url-do-seu-repositorio]
   cd sistema-rural-bm
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   - Copie o arquivo `.env.example` para `.env.local`:
     ```bash
     cp .env.example .env.local
     ```
   - Preencha as chaves API no arquivo `.env.local`:
     - `VITE_GEMINI_API_KEY`: Sua chave do Google AI Studio.
     - `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`: Credenciais do seu projeto Supabase.

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

## 📄 Licença

Este projeto está sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

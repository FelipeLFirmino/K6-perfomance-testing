# Scripts de Teste de Carga para TCC: Segurança vs. Eficiência

## Descrição do Projeto

Este repositório contém os scripts de teste de carga (Load Testing) desenvolvidos em **k6 (JavaScript)** para o Trabalho de Conclusão de Curso (TCC) com o tema "Análise do *Overhead* de Performance em Aplicações Web após a Implementação de Mecanismos de Segurança".

O objetivo principal é medir e comparar o custo de processamento (em milissegundos) adicionado ao *backend* Go da Aplicação de Planejamento de Viagens após a correção de vulnerabilidades de segurança (como falhas de autorização e/ou *Rate Limiting*).

O teste serve como **prova quantitativa** da tese de que é possível equilibrar alta segurança e alta eficiência.

##  Metodologia de Teste

Para garantir a validade científica da pesquisa, a metodologia foca no isolamento e na precisão das métricas do servidor:

1.  **Isolamento do Backend:** Os scripts enviam requisições HTTP **diretamente** para os *endpoints* da API (sem passar pelo *frontend* ou renderização), garantindo que apenas o tempo de processamento do servidor Go seja medido.
2.  **Cenário Autenticado:** Utiliza a função `setup()` do k6 para realizar o login **uma vez** e passar o *token* JWT para os usuários virtuais (`VUs`), simulando um cenário de usuário real e testando rotas protegidas.
3.  **Métrica-Chave (TTFB):** O **Time To First Byte (TTFB)** é a métrica principal, pois reflete o tempo que o servidor leva para processar a lógica de negócios e segurança. Comparar o TTFB `p(95)` (95º percentil) é o núcleo do TCC.

## ⚙️ Pré-requisitos

Para executar os testes de carga, você deve ter:

1.  **k6:** Instalado e acessível na linha de comando.
2.  **Aplicação Alvo:** O *backend* Go (Aplicação de Planejamento de Viagens) rodando localmente em `http://localhost:8080`.
3.  **Credenciais Válidas:** Um usuário de teste ativo na base de dados para que o `setup()` possa autenticar.

##  Scripts

| Arquivo | Cenário de Teste | Endpoints Testados |
| :--- | :--- | :--- |
| `script-teste-carga.js` | **Cenário Básico Autenticado** | `/auth/login`, `/groups` (POST e GET), `/groups/{id}`, `/profile` |

##  Como Executar

### 1. Configuração

Antes da primeira execução, edite o arquivo `script-teste-carga.js` e atualize as credenciais de teste na função `setup()`:

```javascript
// Exemplo de login (MUDE ESTAS CREDENCIAIS!)
const loginPayload = JSON.stringify({
    email: 'seu.usuario@email.com',
    password: 'sua_senha_secreta',
});

# Configurando Firebase Extension - Trigger Email

## Instalação

1. Acesse o Firebase Console: https://console.firebase.google.com
2. Selecione seu projeto (ifrs15-revenue-manager)
3. Vá em **Extensions** no menu lateral
4. Clique em **Explore Extensions**
5. Procure por **"Trigger Email"**
6. Clique em **Install**

## Configuração da Extension

Durante a instalação, configure:

### SMTP Connection
- **SMTP connection URI**: Use seu provedor de email
  - Para Gmail: `smtps://user@gmail.com:password@smtp.gmail.com:465`
  - Para SendGrid: `smtps://apikey:YOUR_SENDGRID_API_KEY@smtp.sendgrid.net:465`
  - Para Mailgun: `smtps://postmaster@YOUR_DOMAIN:YOUR_API_KEY@smtp.mailgun.org:465`

### Email Settings
- **Default FROM address**: `noreply@yourdomain.com`
- **Default Reply-To address**: `support@yourdomain.com`

### Firestore Settings
- **Email documents collection**: `mail`
- **Users collection** (opcional): `users`

## Uso

Para enviar emails, adicione documentos à coleção `mail`:

```javascript
// Exemplo de email simples
await addDoc(collection(db, "mail"), {
  to: "user@example.com",
  message: {
    subject: "Welcome!",
    text: "This is the plaintext section of the email body.",
    html: "<h1>Hello</h1><p>This is the HTML section of the email body.</p>",
  },
});

// Exemplo usando template
await addDoc(collection(db, "mail"), {
  to: "user@example.com",
  template: {
    name: "welcome",
    data: {
      email: "user@example.com",
      name: "John Doe",
    },
  },
});
```

## Templates de Email

Crie templates na coleção `mail_templates`:

### Template: welcome
```javascript
{
  subject: "Bem-vindo ao IFRS 15 Revenue Manager!",
  html: `
    <h1>Bem-vindo, {{name}}!</h1>
    <p>Sua conta foi criada com sucesso.</p>
    <p>Email: {{email}}</p>
  `,
  text: "Bem-vindo ao IFRS 15 Revenue Manager!"
}
```

### Template: credentials
```javascript
{
  subject: "Suas credenciais de acesso - IFRS 15",
  html: `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">IFRS 15 Revenue Manager</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
        <p>Suas credenciais de acesso:</p>
        <ul>
          <li><strong>Email:</strong> {{email}}</li>
          <li><strong>Senha:</strong> {{password}}</li>
          <li><strong>Chave de Licença:</strong> {{licenseKey}}</li>
        </ul>
        <p><a href="{{appUrl}}">Acessar sua conta</a></p>
        <p><strong>Importante:</strong> Altere sua senha após o primeiro login.</p>
      </div>
    </body>
    </html>
  `
}
```

### Template: invoice_paid
```javascript
{
  subject: "Pagamento confirmado - Fatura {{invoiceNumber}}",
  html: `
    <h1>Pagamento Confirmado</h1>
    <p>Recebemos seu pagamento de {{currency}} {{amount}}.</p>
    <p>Número da fatura: {{invoiceNumber}}</p>
    <p>Obrigado!</p>
  `
}
```

### Template: payment_failed
```javascript
{
  subject: "Falha no pagamento - Fatura {{invoiceNumber}}",
  html: `
    <h1>Falha no Pagamento</h1>
    <p>Não conseguimos processar seu pagamento de {{currency}} {{amount}}.</p>
    <p>Por favor, atualize seu método de pagamento.</p>
  `
}
```

## Alternativa: SendGrid

Se preferir usar SendGrid diretamente:

1. Instale a extensão "Send Email with SendGrid"
2. Configure sua API Key do SendGrid
3. A sintaxe de uso é similar

## Monitoramento

- Emails enviados ficam marcados com `delivery.state: "SUCCESS"`
- Emails com erro ficam com `delivery.state: "ERROR"` e `delivery.error`
- Use o Firebase Console para monitorar o status

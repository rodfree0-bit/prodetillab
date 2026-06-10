# Configuración de Correo para Verificación (Gmail)

Para que el sistema de registro pueda enviar los códigos de 6 dígitos, debes configurar una cuenta de Gmail en Firebase Functions.

## 1. Generar Contraseña de Aplicación (App Password)

Google ya no permite usar tu contraseña normal para aplicaciones externas. Debes generar una específica:

1. Ve a tu [Cuenta de Google](https://myaccount.google.com/).
2. En el panel de búsqueda, escribe **"Contraseñas de aplicaciones"**. (Debes tener activada la Verificación en dos pasos).
3. Dale un nombre como "Carwash App" y dale a **Crear**.
4. Copia el código de 16 caracteres que aparece.

## 2. Configurar Firebase Functions

Abre una terminal en la carpeta raíz del proyecto y ejecuta estos dos comandos reemplazando los valores:

```bash
# Configurar el correo emisor
firebase functions:config:set email.user="TU_CORREO@gmail.com"

# Configurar la contraseña de aplicación de 16 caracteres
firebase functions:config:set email.password="tu_app_password_aqui"
```

## 3. Desplegar los cambios

Una vez configurado, despliega la función para que tome los cambios:

```bash
firebase deploy --only functions:sendVerificationCode
```

## 4. Verificar

Puedes revisar si se configuró correctamente ejecutando:
```bash
firebase functions:config:get
```

Si todo está bien, intenta un nuevo registro y revisa los logs en la consola de Firebase o con:
```bash
firebase functions:log --only sendVerificationCode
```

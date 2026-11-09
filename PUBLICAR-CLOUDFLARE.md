# Publicación privada de Mi Plata

Esta versión adapta el dashboard a Cloudflare Workers. El sitio bloquea todas las rutas si falta la configuración de Access o una sesión válida. No hay datos de clientes ni claves en este repositorio.

## Cuenta y publicación

1. Crear una cuenta de Cloudflare. Seleccionar Workers Free y el plan gratuito de Cloudflare Access; no contratar un plan de pago para esta configuración.
2. En Workers & Pages, importar el repositorio `Freddygtz1/miplata`. Usar `npm run build` para compilar y `npx wrangler deploy` para publicar.
3. Antes de configurar los datos, crear una aplicación de Cloudflare Access para el Worker completo. Proteger producción, no solamente la vista previa. Añadir una política Allow con los correos exactos autorizados; no usar una política Bypass ni permitir Everyone.
4. Habilitar One-time PIN como método de inicio de sesión. Los clientes recibirán un código por correo.
5. Copiar el dominio del equipo Access y el identificador de audiencia (AUD) a las variables del Worker.

El nombre inicial propuesto es `miplata-dashboard`; la disponibilidad y URL final se confirman al publicar. No hay un despliegue verificado todavía.

## Lectura privada de Sheets

1. En Google Cloud, habilitar la API Google Sheets y crear una cuenta de servicio dedicada sin roles de administrador ni delegación de todo el dominio.
2. Compartir únicamente la hoja Mi Plata con el correo de esa cuenta de servicio, como Lector. Mantener la hoja privada.
3. Guardar su clave en los secretos de Cloudflare. No pegarla en el chat, GitHub ni archivos públicos.

Variables del Worker:

| Nombre | Contenido |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | Dominio completo `https://tu-equipo.cloudflareaccess.com`, sin barra final |
| `ACCESS_AUD` | Audiencia de la aplicación Access que protege Mi Plata |
| `GOOGLE_SHEET_ID` | Identificador de la hoja Mi Plata |
| `META_B2B_ACCOUNT_ID` | Cuenta Meta B2B permitida |
| `META_B2C_ACCOUNT_ID` | Cuenta Meta B2C permitida |

Secretos del Worker:

| Nombre | Contenido |
| --- | --- |
| `GOOGLE_CLIENT_EMAIL` | Correo de la cuenta de servicio |
| `GOOGLE_PRIVATE_KEY` | Clave privada PEM de la cuenta de servicio |

La configuración de cuentas y hoja se entrega al navegador únicamente después de verificar Access. La clave y el token de Google nunca se entregan al navegador. El alcance de Google es `spreadsheets.readonly`.

## Comprobación obligatoria antes de compartir

- Sin sesión, `/`, `/api/config` y `/api/sheets` deben quedar bloqueados.
- Un correo autorizado debe poder entrar con su código y ver datos reales de la hoja.
- Un correo fuera de la política no debe poder entrar.
- Actualizar datos debe volver a consultar la hoja. n8n sigue siendo responsable de escribirla.
- Comparar descargas, registros y tasa con las filas del mismo periodo en Sheets.

## Verificación local

```sh
npm install
npm test
npm run build
```

Los tests usan claves temporales y datos sintéticos. Nunca cambian los datos de Sheets ni contactan la cuenta de Google de producción.

Referencias oficiales: [Workers y Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [validación de sesiones](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [lectura de Google desde servidor](https://developers.google.com/identity/protocols/oauth2/service-account).

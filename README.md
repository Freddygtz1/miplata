# Mi Plata · Dashboard marketing de pauta

Dashboard con identidad visual BLNK, indicadores B2B/B2C, campañas, bitácora y embudo B2C (impresiones → descargas → registros). Incluye el porcentaje de descargas que se registran, calculado como registros / descargas × 100 para el periodo seleccionado.

## Publicación en Cloudflare

Esta versión incluye un servidor para Cloudflare Workers, lectura privada de Google Sheets y validación de sesión de Cloudflare Access. Los clientes pueden entrar con un código enviado a su correo, sin conceder permisos sobre sus cuentas de Google.

**Preparado y probado localmente; publicación y conexión real pendientes de configurar las cuentas.** Consulta [PUBLICAR-CLOUDFLARE.md](PUBLICAR-CLOUDFLARE.md).

No hay datos de campañas, cuentas reales, identificadores de hojas ni credenciales en este repositorio público. La configuración real se guarda en el servidor; la clave de Google se guarda como secreto.

## Comandos

Requiere Node.js 22 o posterior.

```sh
npm install
npm test
npm run build
npm run deploy
```

Cloudflare puede ejecutar la compilación y publicación desde este repositorio. `wrangler.jsonc` configura el servidor para comprobar el acceso antes de servir cualquier archivo. Si falta Access o una sesión válida, el servidor devuelve 403. Si falta la conexión a Sheets, indica configuración pendiente en vez de mostrar datos inventados.

## Datos

Pestañas esperadas en la hoja:

- `meta_diario` A:N: métricas por cuenta, campaña y día.
- `bitacora` A:F: fecha, segmento, campaña, cambio, responsable y observación.
- `embudo_b2c` A:J: fecha, campaña, vistas, descargas, registros, clave de fila, cuenta, campaña ID, evento de registro y actualización.

Se conserva el contrato de datos del dashboard anterior y el límite de 10 000 filas por pestaña. n8n escribe la hoja; el botón Actualizar datos y la consulta automática cada 15 minutos vuelven a leerla.

Las impresiones no son usuarios únicos. Registros atribuidos por Meta no significa KYC aprobado. La tasa compara eventos atribuidos del periodo, sin demostrar que correspondan a la misma cohorte de personas. Sin denominador válido se muestra N/D.

Los logotipos y fuentes se conservan incorporados en HTML y CSS. No se concede licencia de redistribución de marcas ni tipografías de terceros.

# Mi Plata · Dashboard marketing de pauta

Código del dashboard de Mi Plata con identidad visual BLNK. Incluye KPIs B2B y B2C, campañas, inversión diaria, bitácora de cambios y embudo B2C: impresiones → descargas → registros.

## Estado de esta copia

Se conserva el diseño y la lógica del dashboard existente. Esta copia pública no contiene datos de campañas, credenciales, identificadores reales de cuentas, identificadores de hojas ni configuración de acceso de la plataforma original.

**Subir este repositorio no publica una aplicación ni habilita la conexión con Google Sheets.** El servidor incluido como referencia corresponde a la integración original de Sites. GitHub Pages por sí solo no ejecuta ese servidor ni protege los datos de clientes.

## Ver el diseño en tu computadora

Requiere Node.js 22 o posterior. No necesita instalar paquetes.

```sh
npm start
```

Abrir http://127.0.0.1:8765. La vista local muestra un aviso de conexión pendiente; no utiliza datos ficticios ni consulta una hoja pública.

## Funciones conservadas

- Filtros por segmento, campaña y fecha: 7 días, 15 días, 1 mes, 3 meses, 6 meses, 1 año y periodo personalizado.
- Embudo B2C y desglose por campaña.
- Tasa de registro: suma de registros / suma de descargas × 100. Sin denominador válido se muestra N/D.
- Botón Actualizar datos y consulta cada 15 minutos mientras la página está visible.
- Bitácora de cambios y fecha de la última extracción.
- Validación de esquema, moneda, cuentas y duplicados; una falla conserva la última lectura válida de la sesión y señala el problema.

Las impresiones no son usuarios únicos. Los registros atribuidos por Meta no equivalen a KYC aprobado. La tasa compara eventos atribuidos del periodo; no representa una cohorte verificada de personas.

## Archivos

- `index.html`: estructura y logotipos incorporados.
- `styles.css`, `blnk-theme.css`, `connected.css`: estilos y fuentes incorporadas.
- `app.mjs`: interfaz, filtros, actualización y gráficos.
- `model.mjs`: validación y cálculos.
- `sites-worker.mjs`: adaptador original de servidor para el conector de Google Drive de Sites.
- `build.mjs`: empaqueta los archivos públicos con el adaptador de Sites.
- `preview.mjs`: vista local sin conexión a datos.

Los recursos gráficos se incluyen en los archivos para mantener sencilla la estructura. No se concede una licencia de redistribución de marcas ni tipografías de terceros.

## Conectar los datos al publicar

El navegador solicita `POST /api/sheets` en el mismo sitio, con sesión del usuario. El servidor debe comprobar qué cliente puede consultar cada usuario antes de leer Sheets. Las credenciales de Google y Meta deben permanecer en el servidor.

Para reutilizar la plataforma original de Sites, configurar sus permisos y enlace de conector; sustituir `TU_CONNECTOR_ID` y `TU_SPREADSHEET_ID` en `sites-worker.mjs`. Este adaptador depende del enlace `ctx.props.CONNECTORS` proporcionado por Sites; no funciona directamente como un servidor de Vercel, GitHub Pages o Node.js.

En una publicación privada, configurar también las cuentas permitidas en `model.mjs` y los textos/enlaces correspondientes del frontend. En este repositorio público todos los identificadores fueron sustituidos por `TU_CUENTA_B2B`, `TU_CUENTA_B2C` y `TU_SPREADSHEET_ID`. No subir la configuración real a este repositorio público.

Para migrar a otro alojamiento falta implementar un adaptador de servidor con autenticación de clientes y lectura privada de Google Sheets. La interfaz puede mantenerse; el enlace Acceder de esta copia apunta al acceso original de Sites y debe adaptarse al proveedor de acceso elegido.

### Contrato de respuesta

```json
{
  "status": "success",
  "checkedAt": "2026-01-01T00:00:00.000Z",
  "sources": {
    "meta": {"status":"success","result":{"structuredContent":{"values":[]}}},
    "log": {"status":"success","result":{"structuredContent":{"values":[]}}},
    "funnel": {"status":"success","result":{"structuredContent":{"values":[]}}}
  }
}
```

Cada `values` contiene primero los encabezados y luego las filas. El arreglo vacío anterior describe la forma de la respuesta; no es una respuesta de datos válida.

Pestañas y encabezados esperados:

- **meta_diario** (A:N): `row_key, segment, account_id, campaign_id, campaign, date, spend, impressions, link_clicks, leads, installs, currency, actions_json, extracted_at`.
- **bitacora** (A:F): `fecha, segmento, campana, cambio, responsable, observacion`.
- **embudo_b2c** (A:J): `fecha, campana, vistas, descargas, registros, row_key, account_id, campaign_id, evento_registro, actualizado_en`.

El evento de registro esperado es `app_custom_event.fb_mobile_complete_registration`. La clave de cada fila de métricas/embudo es `account_id|campaign_id|AAAA-MM-DD`. La moneda esperada es USD. Se admiten hasta 10 000 filas por pestaña en el adaptador original.

n8n sigue siendo responsable de cargar Sheets. La actualización del dashboard vuelve a leer la hoja; no ejecuta por sí misma el flujo de n8n.

## Comprobar y empaquetar

```sh
npm run check
npm run build
```

La compilación genera `dist/server/index.js`. La configuración de despliegue de Sites es privada y no está incluida. No hay una aplicación nueva publicada desde este repositorio todavía.

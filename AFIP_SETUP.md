# Configuración de AFIP - Facturación Electrónica (Modelo Delegado/SaaS)

Esta guía te ayudará a configurar la integración con AFIP para generar facturas electrónicas usando el **modelo delegado** (también conocido como modelo SaaS o de representación).

## ¿Qué es el Modelo Delegado?

En este modelo:
- ✅ **El proveedor del sistema** (vos) configurás **UN** certificado maestro
- ✅ **Tus clientes** simplemente se "relacionan" con tu CUIT desde su AFIP
- ✅ **El sistema** factura en nombre de cada cliente usando tu certificado + su CUIT
- ✅ **Mucho más simple** para tus clientes: no necesitan generar certificados

---

## Índice

1. [Configuración del Proveedor (Una Sola Vez)](#configuración-del-proveedor-una-sola-vez)
2. [Configuración del Cliente](#configuración-del-cliente)
3. [Solución de Problemas](#solución-de-problemas)

---

## Configuración del Proveedor (Una Sola Vez)

Esta configuración la hacés vos, como proveedor del sistema, **UNA SOLA VEZ**.

### Paso 1: Generar Certificado Maestro

Usá OpenSSL para generar tu certificado maestro:

```bash
# 1. Generar clave privada
openssl genrsa -out afip-master.key 2048

# 2. Generar Certificate Signing Request (CSR)
openssl req -new -key afip-master.key -out afip-master.csr \
  -subj "/C=AR/O=TU_EMPRESA/CN=TU_EMPRESA/serialNumber=CUIT TU_CUIT"

# 3. Autofirmar el certificado (válido por 2 años)
openssl x509 -req -days 730 -in afip-master.csr \
  -signkey afip-master.key -out afip-master.crt
```

⚠️ **Importante**: Reemplazá `TU_EMPRESA` y `TU_CUIT` con tus datos reales.

### Paso 2: Registrar el Certificado en AFIP

#### Para Homologación (Pruebas):

1. Ingresá a **AFIP** con tu **Clave Fiscal**
2. Buscá **"Administrador de Certificados Digitales"**
3. Hacé clic en **"Solicitudes"** o **"Generar Nuevo Certificado"**
4. Seleccioná **"Solicitud de Certificado con CSR"**
5. Copiá el contenido del archivo `afip-master.csr`:
   ```bash
   cat afip-master.csr
   ```
6. Pegá el contenido completo (incluyendo BEGIN/END)
7. Asociá el certificado al servicio **"wsfe"** (Web Service Factura Electrónica)
8. AFIP genera el certificado → descargalo o copiá el contenido

#### Para Producción:

Mismo proceso, pero en el ambiente de **producción** de AFIP.

### Paso 3: Configurar Variables de Entorno

Agregá estas variables a tu archivo `.env` o a tu sistema de deployment:

```bash
# CUIT del proveedor (tu CUIT)
AFIP_PROVIDER_CUIT="20314939493"

# Certificado maestro (formato PEM con \n)
AFIP_MASTER_CERT="-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----"

# Clave privada maestra (formato PEM con \n)
AFIP_MASTER_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----"

# Modo: "homologacion" o "produccion"
AFIP_MODE="homologacion"
```

**Consejos**:
- Para certificados multi-línea, reemplazá saltos de línea con `\n`
- En producción, usá variables de entorno seguras (no archivos .env)
- Nunca commitees estos valores en Git

### Paso 4: Verificar Configuración

Reiniciá tu aplicación y verificá que los certificados se carguen correctamente. En el tab AFIP de Settings, deberías ver:
- ✅ Certificado Maestro: Configurado
- ✅ CUIT del Proveedor: (tu CUIT)
- ✅ Modo: Homologación o Producción

---

## Configuración del Cliente

Esta configuración la hace **cada cliente** desde su cuenta.

### Paso 1: Dar de Alta el Punto de Venta en AFIP

1. Ingresá a **AFIP** con tu **Clave Fiscal** (la del cliente)
2. Andá a **"Administración de puntos de venta y domicilios"**
3. Seleccioná tu empresa
4. Hacé clic en **"A/B/M de Puntos de venta"**
5. Agregá un nuevo punto de venta:
   - **Número**: Elegí un número (1, 2, 3, etc.)
   - **Sistema**: Seleccioná **"RECE para aplicativo y web services"** (para Responsables Inscriptos) o **"Factura electrónica - Monotributo - Web Services"** (para Monotributistas)
   - **Domicilio**: Seleccioná tu domicilio fiscal
6. Guardá el número de punto de venta asignado

### Paso 2: Autorizar al Proveedor en AFIP

1. En **AFIP**, andá a **"Administrador de Relaciones de Clave Fiscal"**
2. Hacé clic en **"Nueva Relación"**
3. Buscá el servicio **"Factura Electrónica"** o **"wsfe"**
4. En el campo **"Representante"**, ingresá el **CUIT del proveedor del sistema**
5. Confirmá la relación

⚠️ **Importante**: Esta relación le permite al proveedor emitir facturas electrónicas en tu nombre, usando tu CUIT. El proveedor **NO** tiene acceso a tu Clave Fiscal ni a ningún otro dato de tu empresa.

### Paso 3: Configurar en el Sistema POS

1. Iniciá sesión en el sistema POS
2. Andá a **Configuración** → **AFIP**
3. Completá:
   - **Punto de Venta**: El número que obtuviste en el Paso 1
   - **Tipo de Factura por Defecto**: Elegí A, B o C según tu situación fiscal
4. Hacé clic en **"Guardar Configuración"**
5. Hacé clic en **"Probar Conexión"** para verificar
6. Si todo funciona, activá el switch **"Activar Facturación AFIP"**

¡Listo! Ya podés emitir facturas electrónicas desde el POS.

---

## Solución de Problemas

### Error: "Configuración maestra AFIP no encontrada"

**Causa**: El proveedor no configuró las variables de entorno.

**Solución** (Proveedor):
1. Verificá que las variables estén definidas: `AFIP_PROVIDER_CUIT`, `AFIP_MASTER_CERT`, `AFIP_MASTER_KEY`
2. Verificá el formato (PEM con `\n` para saltos de línea)
3. Reiniciá la aplicación

### Error: "Punto de venta no configurado"

**Causa**: El cliente no ingresó su punto de venta.

**Solución** (Cliente):
1. Completá el campo "Punto de Venta" en Configuración → AFIP
2. Guardá la configuración

### Error: "No se pudo obtener el token" o "Error al conectar con AFIP"

**Posibles causas**:

1. **Certificado no válido en AFIP**:
   - Verificá que el certificado maestro esté cargado en AFIP
   - Verificá que esté asociado al servicio `wsfe`
   - Verificá que no haya expirado (vigencia: 2 años)

2. **CUIT incorrecto**:
   - El `AFIP_PROVIDER_CUIT` debe coincidir con el CUIT usado al generar el certificado

3. **Formato de certificado incorrecto**:
   - Los certificados deben estar en formato PEM
   - Deben incluir las líneas `-----BEGIN CERTIFICATE-----` y `-----END CERTIFICATE-----`

4. **Cliente no autorizó al proveedor**:
   - El cliente debe crear la relación en "Administrador de Relaciones de Clave Fiscal"
   - El CUIT del representante debe ser el del proveedor

### Error: "No se puede generar CAE"

**Posibles causas**:

1. **Datos de factura incorrectos**:
   - Verificá el CUIT o DNI del cliente
   - Verificá los importes (total, neto, IVA)
   - Verificá que el tipo de factura sea correcto (A, B, C)

2. **Punto de venta sin stock de números**:
   - Contactá a AFIP para solicitar más numeración

3. **Cliente no está en condición de facturar**:
   - Verificá la situación fiscal del cliente en AFIP
   - Verificá que el cliente tenga alta en AFIP para el tipo de factura

---

## Información Técnica

### URLs de AFIP

| Servicio | Homologación | Producción |
|----------|--------------|------------|
| **WSAA** (Auth) | https://wsaahomo.afip.gov.ar/ws/services/LoginCms | https://wsaa.afip.gov.ar/ws/services/LoginCms |
| **WSFEv1** (Facturas) | https://wswhomo.afip.gov.ar/wsfev1/service.asmx | https://servicios1.afip.gov.ar/wsfev1/service.asmx |

### Flujo de Autenticación (Delegado)

```
┌─────────────┐
│  PROVEEDOR  │  (tiene certificado maestro)
└──────┬──────┘
       │
       │  1. Obtiene token WSAA (usando certificado maestro)
       │
       ▼
┌─────────────┐
│    AFIP     │
└──────┬──────┘
       │
       │  2. Retorna token válido por 12 horas
       │
       ▼
┌─────────────┐
│   SISTEMA   │
└──────┬──────┘
       │
       │  3. Factura usando: token + CUIT del CLIENTE
       │
       ▼
┌─────────────┐
│   CLIENTE   │  (solo configuró punto de venta)
└─────────────┘
```

### Diferencias con el Modelo Directo

| Característica | Modelo Directo | Modelo Delegado (SaaS) |
|----------------|----------------|------------------------|
| Certificado por tenant | ✅ Sí | ❌ No (uno maestro) |
| Complejidad para el cliente | Alta | Baja |
| Gestión de tokens | Por tenant | Centralizada |
| Escalabilidad | Media | Alta |
| Costo operativo | Alto | Bajo |
| Mejor para | Pocas empresas | Muchas empresas (SaaS) |

---

## Paso a Producción

### Checklist Proveedor

- [ ] Generar certificado de PRODUCCIÓN (diferente al de homologación)
- [ ] Cargar certificado en AFIP ambiente de producción
- [ ] Actualizar `AFIP_MODE="produccion"` en variables de entorno
- [ ] Actualizar `AFIP_MASTER_CERT` y `AFIP_MASTER_KEY` con certificado de producción
- [ ] Reiniciar aplicación
- [ ] Verificar que el tab AFIP muestre "Modo: Producción"

### Checklist Cliente

- [ ] Repetir Paso 1 y Paso 2 en ambiente de PRODUCCIÓN de AFIP
- [ ] Verificar configuración en el sistema
- [ ] Probar conexión
- [ ] Generar factura de prueba
- [ ] Verificar CAE en comprobante

⚠️ **Importante**: A partir de este momento, todas las facturas serán **REALES y OFICIALES**.

---

## Soporte

Si tenés problemas:

1. **Verificá la consola del navegador** (F12) para errores en el cliente
2. **Verificá los logs del servidor** para detalles técnicos
3. **Consultá la documentación oficial de AFIP**:
   - [Manual WSFEv1](http://www.afip.gob.ar/fe/documentos/manual_desarrollador_COMPG_v2_10.pdf)
4. **Contactá al soporte técnico** con:
   - Modo (homologación/producción)
   - Mensaje de error completo
   - Capturas de pantalla

---

¡Facturación Electrónica Delegada Lista! 🎉

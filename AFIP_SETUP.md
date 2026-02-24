# Configuración de AFIP - Facturación Electrónica

Esta guía te ayudará a configurar la integración con AFIP para generar facturas electrónicas.

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Obtener Certificados de AFIP](#obtener-certificados-de-afip)
3. [Configuración en el Sistema](#configuración-en-el-sistema)
4. [Pruebas en Homologación](#pruebas-en-homologación)
5. [Paso a Producción](#paso-a-producción)
6. [Solución de Problemas](#solución-de-problemas)

---

## Requisitos Previos

Antes de comenzar, asegurate de tener:

- ✅ **Clave Fiscal nivel 3** (AFIP)
- ✅ **CUIT** del comercio
- ✅ **Punto de venta** asignado por AFIP
- ✅ Acceso al sistema como **ADMIN**

---

## Obtener Certificados de AFIP

### Paso 1: Generar Certificado y Clave Privada

Podés generar el certificado de dos formas:

#### Opción A: Usando OpenSSL (Recomendado)

```bash
# 1. Generar clave privada
openssl genrsa -out afip.key 2048

# 2. Generar Certificate Signing Request (CSR)
openssl req -new -key afip.key -out afip.csr \
  -subj "/C=AR/O=TU_EMPRESA/CN=TU_EMPRESA/serialNumber=CUIT TU_CUIT"

# 3. Autofirmar el certificado (válido por 2 años)
openssl x509 -req -days 730 -in afip.csr \
  -signkey afip.key -out afip.crt
```

#### Opción B: Solicitar a AFIP

Podés solicitar que AFIP genere el certificado por vos (más simple pero menos control).

### Paso 2: Cargar Certificado en AFIP

1. Ingresá a **AFIP** con tu **Clave Fiscal**
2. Andá a **Administrador de Relaciones de Clave Fiscal**
3. Seleccioná **Nueva Relación**
4. En el buscador, escribí: **wsfe** (Facturación Electrónica)
5. Seleccioná el servicio **wsfe**
6. Elegí:
   - **Certificado**: Subí el archivo `afip.crt` que generaste
   - **Seleccioná relación**: Adherir servicio
7. Guardá la relación

### Paso 3: Descargar Archivos

Vas a necesitar dos archivos:

1. **Certificado X.509** (`.crt` o `.pem`)
   - Es el archivo que subiste o que AFIP generó

2. **Clave Privada** (`.key`)
   - Es el archivo `afip.key` que generaste
   - ⚠️ **MUY IMPORTANTE**: No compartas este archivo con nadie

---

## Configuración en el Sistema

### 1. Acceder a Configuración

1. Iniciá sesión como **ADMIN**
2. Andá a **Configuración** (menú lateral)
3. Seleccioná la pestaña **AFIP**

### 2. Configuración General

Completá los siguientes campos:

| Campo | Descripción | Valor Inicial |
|-------|-------------|---------------|
| **Modo de Operación** | Ambiente de trabajo | `Homologación` (para pruebas) |
| **Punto de Venta** | Número asignado por AFIP | `1` (o el que te asignaron) |
| **Tipo de Factura por Defecto** | A, B o C | `B` (Consumidor Final) |
| **Activar Facturación AFIP** | Habilitar sistema | ❌ Off (hasta terminar config) |

#### Tipos de Factura

- **Factura A**: Para Responsables Inscriptos (discrimina IVA)
- **Factura B**: Para Consumidor Final o Monotributistas (incluye IVA)
- **Factura C**: Para operaciones exentas

### 3. Cargar Certificados

1. **Certificado (archivo .crt o .pem)**
   - Hacé clic en "Seleccionar archivo"
   - Seleccioná tu archivo `afip.crt`

2. **Clave Privada (archivo .key)**
   - Hacé clic en "Seleccionar archivo"
   - Seleccioná tu archivo `afip.key`

3. Hacé clic en **"Guardar Configuración"**

### 4. Obtener Token de AFIP

Una vez guardada la configuración:

1. Hacé clic en **"Obtener Token AFIP"**
2. El sistema se conectará con AFIP (WSAA)
3. Si todo está bien, verás el mensaje: **"Token obtenido"**
4. El token es válido por **12 horas**

💡 **Tip**: El sistema te mostrará cuándo expira el token. Deberás renovarlo periódicamente.

### 5. Probar Conexión

Antes de activar:

1. Hacé clic en **"Probar Conexión"**
2. Deberías ver: **"Conexión exitosa con AFIP"**
3. Si hay error, revisá la [sección de problemas](#solución-de-problemas)

### 6. Activar Facturación

Si la prueba fue exitosa:

1. Activá el switch **"Activar Facturación AFIP"**
2. Hacé clic en **"Guardar Configuración"**

¡Listo! El sistema está configurado para facturación electrónica.

---

## Pruebas en Homologación

### ¿Qué es Homologación?

Es el ambiente de **pruebas** de AFIP. Todo lo que hagas acá NO es real:
- ✅ Podés probar sin límites
- ✅ Los CAE generados NO son válidos oficialmente
- ✅ No afecta tu situación fiscal

### Datos de Prueba

Usá estos datos para probar:

| Campo | Valor de Prueba |
|-------|-----------------|
| CUIT Cliente | `20000000000` |
| Documento | `11111111` |
| Importe | Cualquier valor |

### Generar Primera Factura de Prueba

1. Andá al **POS**
2. Creá una venta normal
3. Al confirmar la venta, el sistema:
   - Se conecta con AFIP automáticamente
   - Obtiene el número de factura
   - Genera el CAE
   - Lo guarda en la venta

4. Verificá que la venta tenga:
   - ✅ Número de factura
   - ✅ CAE (Código de Autorización Electrónica)
   - ✅ Fecha de vencimiento del CAE

### Consultar Facturas en AFIP

Podés verificar en:
- **Web Service AFIP Homologación**: https://wswhomo.afip.gov.ar/wsfev1/

---

## Paso a Producción

⚠️ **IMPORTANTE**: Solo pasá a producción cuando hayas probado todo en homologación.

### Requisitos

- ✅ Todas las pruebas exitosas en homologación
- ✅ Certificado de **PRODUCCIÓN** (diferente al de homologación)
- ✅ Punto de venta habilitado en producción

### Pasos

1. Generá un **nuevo certificado** para producción (mismo proceso)
2. Cargalo en AFIP para el servicio `wsfe` en **ambiente de producción**
3. En el sistema, cambiá:
   - **Modo de Operación**: `Producción`
   - **Certificado**: Subí el nuevo certificado de producción
   - **Clave Privada**: Subí la nueva clave de producción
4. Hacé clic en **"Guardar Configuración"**
5. **"Obtener Token AFIP"** nuevamente
6. **"Probar Conexión"** para verificar
7. Activá la facturación

⚠️ A partir de este momento, todas las facturas serán **REALES y OFICIALES**.

---

## Solución de Problemas

### Error: "No se pudo obtener el token"

**Posibles causas:**

1. **Certificado o clave incorrectos**
   - Verificá que sean los archivos correctos
   - Asegurate que el certificado esté en formato PEM
   - La clave no debe tener contraseña

2. **Certificado no cargado en AFIP**
   - Ingresá a AFIP y verificá que el servicio `wsfe` esté habilitado
   - Revisá que el certificado sea el mismo

3. **CUIT incorrecto**
   - El CUIT del sistema debe coincidir con el del certificado

### Error: "Certificado expirado"

Los certificados vencen cada 2 años (o menos).

**Solución:**
1. Generá un nuevo certificado
2. Cargalo en AFIP
3. Actualizá en el sistema

### Error: "Token expirado"

Los tokens vencen cada 12 horas.

**Solución:**
- Hacé clic en **"Obtener Token AFIP"** nuevamente

### Error: "Punto de venta no autorizado"

**Solución:**
1. Verificá en AFIP qué puntos de venta tenés habilitados
2. Actualizá el campo **"Punto de Venta"** en el sistema

### Error: "No se puede generar CAE"

**Posibles causas:**

1. **Token expirado**: Renovalo
2. **Datos de factura incorrectos**:
   - Verificá CUIT del cliente
   - Verificá importes
   - Verificá que el tipo de factura sea correcto
3. **Punto de venta sin stock de números**: Contactá a AFIP

---

## Información Técnica

### URLs de AFIP

| Servicio | Homologación | Producción |
|----------|--------------|------------|
| **WSAA** (Auth) | https://wsaahomo.afip.gov.ar/ws/services/LoginCms | https://wsaa.afip.gov.ar/ws/services/LoginCms |
| **WSFEv1** (Facturas) | https://wswhomo.afip.gov.ar/wsfev1/service.asmx | https://servicios1.afip.gov.ar/wsfev1/service.asmx |

### Códigos de Tipo de Comprobante

| Tipo | Código | Descripción |
|------|--------|-------------|
| A | 1 | Factura A |
| B | 6 | Factura B |
| C | 11 | Factura C |

### Códigos de Documento

| Tipo | Código |
|------|--------|
| CUIT | 80 |
| CUIL | 86 |
| DNI | 96 |
| Consumidor Final | 99 |

### Códigos de IVA

| Alícuota | Código |
|----------|--------|
| 0% | 3 |
| 10.5% | 4 |
| 21% | 5 |
| 27% | 6 |

---

## Soporte

Si tenés problemas:

1. **Revisá la consola del navegador** (F12) para ver errores
2. **Verificá los logs del servidor** para detalles técnicos
3. **Consultá la documentación oficial de AFIP**:
   - [Manual WSFEv1](http://www.afip.gob.ar/fe/documentos/manual_desarrollador_COMPG_v2_10.pdf)
4. **Contactá al soporte técnico** con:
   - Modo (homologación/producción)
   - Mensaje de error completo
   - Capturas de pantalla

---

## Checklist de Implementación

Usá este checklist para verificar que todo esté correcto:

### Homologación
- [ ] Certificado generado
- [ ] Certificado cargado en AFIP
- [ ] Certificado subido al sistema
- [ ] Clave privada subida al sistema
- [ ] Modo configurado en "Homologación"
- [ ] Punto de venta configurado
- [ ] Token AFIP obtenido exitosamente
- [ ] Conexión probada exitosamente
- [ ] Primera factura de prueba generada
- [ ] CAE recibido correctamente

### Producción
- [ ] Todo lo anterior probado en homologación
- [ ] Nuevo certificado generado para producción
- [ ] Certificado de producción cargado en AFIP
- [ ] Modo cambiado a "Producción"
- [ ] Certificado de producción subido al sistema
- [ ] Token de producción obtenido
- [ ] Conexión de producción probada
- [ ] Primera factura real generada y verificada

---

¡Facturación Electrónica Lista! 🎉

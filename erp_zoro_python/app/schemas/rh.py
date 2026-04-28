from typing import Optional
from pydantic import BaseModel


class PerfilRHUpsert(BaseModel):
    FechaNacimiento: Optional[str] = None
    CURP: Optional[str] = None
    RFC: Optional[str] = None
    NSS: Optional[str] = None
    EstadoCivil: Optional[str] = None
    Genero: Optional[str] = None
    Direccion: Optional[str] = None
    Ciudad: Optional[str] = None
    Estado: Optional[str] = None
    CodigoPostal: Optional[str] = None
    Pais: Optional[str] = None
    NumeroEmpleado: Optional[str] = None
    FechaIngreso: Optional[str] = None
    Puesto: Optional[str] = None
    Departamento: Optional[str] = None
    SalarioMensual: Optional[float] = None
    TipoContrato: Optional[str] = None
    BancoPrincipal: Optional[str] = None
    NumeroCuentaPrincipal: Optional[str] = None
    CLABE: Optional[str] = None
    NombreTitularCuenta: Optional[str] = None
    ContactoEmergenciaPrincipal: Optional[str] = None
    TelefonoEmergenciaPrincipal: Optional[str] = None
    Alergias: Optional[str] = None
    TipoSangre: Optional[str] = None
    NotasMedicas: Optional[str] = None


class ContactoEmergenciaCreate(BaseModel):
    Nombre: str
    Telefono: str
    Parentesco: Optional[str] = None
    TelefonoAlterno: Optional[str] = None
    Direccion: Optional[str] = None
    EsPrincipal: Optional[bool] = False
    Notas: Optional[str] = None


class ContactoEmergenciaUpdate(BaseModel):
    Nombre: Optional[str] = None
    Telefono: Optional[str] = None
    Parentesco: Optional[str] = None
    TelefonoAlterno: Optional[str] = None
    Direccion: Optional[str] = None
    EsPrincipal: Optional[bool] = False
    Notas: Optional[str] = None


class CuentaBancariaCreate(BaseModel):
    Banco: str
    NumeroCuenta: str
    CLABE: Optional[str] = None
    NumeroTarjeta: Optional[str] = None
    Moneda: Optional[str] = "MXN"
    EsPrincipal: Optional[bool] = False
    NombreTitular: Optional[str] = None


class CuentaBancariaUpdate(BaseModel):
    Banco: Optional[str] = None
    NumeroCuenta: Optional[str] = None
    CLABE: Optional[str] = None
    NumeroTarjeta: Optional[str] = None
    Moneda: Optional[str] = None
    EsPrincipal: Optional[bool] = False
    NombreTitular: Optional[str] = None

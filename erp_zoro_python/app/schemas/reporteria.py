from typing import Optional
from pydantic import BaseModel


class FacturaListItem(BaseModel):
    Factura_Id: Optional[int] = None
    UUID: Optional[str] = None
    FacturamaId: Optional[str] = None
    Serie: Optional[str] = None
    Folio: Optional[str] = None
    ReceptorRFC: Optional[str] = None
    ReceptorNombre: Optional[str] = None
    Subtotal: Optional[float] = None
    IVA: Optional[float] = None
    Total: Optional[float] = None
    Moneda: Optional[str] = None
    Status: Optional[str] = None
    FechaTimbrado: Optional[str] = None
    Venta_Id: Optional[int] = None
    FechaVenta: Optional[str] = None


class Estadisticas(BaseModel):
    TotalFacturas: Optional[int] = None
    FacturasVigentes: Optional[int] = None
    FacturasCanceladas: Optional[int] = None
    TotalFacturado: Optional[float] = None
    PromedioFactura: Optional[float] = None

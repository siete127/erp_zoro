-- Agregar columna CompanySolicitante_Id a ERP_OP_PRODUCCION
-- Company_Id pasará a ser siempre PTC (empresa productora)
-- CompanySolicitante_Id es la empresa que solicita la producción (CALI, SER, REMA)

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ERP_OP_PRODUCCION' AND COLUMN_NAME = 'CompanySolicitante_Id'
)
BEGIN
  ALTER TABLE ERP_OP_PRODUCCION ADD CompanySolicitante_Id INT NULL;
  PRINT 'Columna CompanySolicitante_Id agregada a ERP_OP_PRODUCCION';
  
  -- Copiar Company_Id actual a CompanySolicitante_Id (migración de datos existentes)
  UPDATE ERP_OP_PRODUCCION SET CompanySolicitante_Id = Company_Id;
  PRINT 'Datos migrados: CompanySolicitante_Id = Company_Id (existentes)';
END
GO

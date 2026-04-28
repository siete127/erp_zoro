-- Tabla para productos recurrentes por cliente
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ERP_CLIENT_RECURRING_PRODUCTS')
BEGIN
  CREATE TABLE ERP_CLIENT_RECURRING_PRODUCTS (
    RecurringProduct_Id INT IDENTITY(1,1) PRIMARY KEY,
    Client_Id INT NOT NULL,
    Producto_Id INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_ClientRecurringProducts_Client FOREIGN KEY (Client_Id) REFERENCES ERP_CLIENT(Client_Id) ON DELETE CASCADE,
    CONSTRAINT FK_ClientRecurringProducts_Product FOREIGN KEY (Producto_Id) REFERENCES ERP_PRODUCTOS(Producto_Id) ON DELETE CASCADE,
    CONSTRAINT UQ_ClientProduct UNIQUE (Client_Id, Producto_Id)
  );
END
GO

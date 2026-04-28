-- Tabla de precios personalizados por cliente
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_CLIENT_PRODUCT_PRICES' AND xtype='U')
CREATE TABLE ERP_CLIENT_PRODUCT_PRICES (
  ClientPrice_Id INT IDENTITY(1,1) PRIMARY KEY,
  Client_Id INT NOT NULL,
  Product_Id INT NOT NULL,
  CustomPrice DECIMAL(18,2) NOT NULL,
  IsActive BIT DEFAULT 1,
  CreatedBy INT,
  CreatedAt DATETIME DEFAULT GETDATE(),
  UpdatedAt DATETIME DEFAULT GETDATE(),
  CONSTRAINT FK_ClientPrice_Client FOREIGN KEY (Client_Id) REFERENCES ERP_CLIENTS(Client_Id) ON DELETE CASCADE,
  CONSTRAINT FK_ClientPrice_Product FOREIGN KEY (Product_Id) REFERENCES ERP_PRODUCTS(Product_Id) ON DELETE CASCADE,
  CONSTRAINT UK_Client_Product UNIQUE (Client_Id, Product_Id)
);

-- Tabla de solicitudes de cambio de precio (requiere doble aprobación)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ERP_PRICE_CHANGE_REQUESTS' AND xtype='U')
CREATE TABLE ERP_PRICE_CHANGE_REQUESTS (
  Request_Id INT IDENTITY(1,1) PRIMARY KEY,
  Client_Id INT NOT NULL,
  Product_Id INT NOT NULL,
  CurrentPrice DECIMAL(18,2),
  NewPrice DECIMAL(18,2) NOT NULL,
  RequestedBy INT NOT NULL,
  Approver1_Email VARCHAR(255) NOT NULL,
  Approver2_Email VARCHAR(255) NOT NULL,
  Approver1_Status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  Approver2_Status VARCHAR(20) DEFAULT 'pending',
  Approver1_Date DATETIME,
  Approver2_Date DATETIME,
  Status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, completed
  Reason VARCHAR(500),
  Sale_Id INT, -- ID de venta asociada (si aplica)
  CreatedAt DATETIME DEFAULT GETDATE(),
  CompletedAt DATETIME,
  CONSTRAINT FK_PriceReq_Client FOREIGN KEY (Client_Id) REFERENCES ERP_CLIENTS(Client_Id),
  CONSTRAINT FK_PriceReq_Product FOREIGN KEY (Product_Id) REFERENCES ERP_PRODUCTS(Product_Id),
  CONSTRAINT FK_PriceReq_User FOREIGN KEY (RequestedBy) REFERENCES ERP_USERS(User_Id)
);

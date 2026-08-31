/*
  TRÉSOR Boutique - SQL Server schema starter
  Exécuter sur SQL Server si tu veux une base rapide hors migrations EF.
*/

CREATE TABLE Roles (
    Id INT IDENTITY PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL UNIQUE,
    Description NVARCHAR(200) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
);

CREATE TABLE Users (
    Id INT IDENTITY PRIMARY KEY,
    FullName NVARCHAR(120) NOT NULL,
    Username NVARCHAR(50) NOT NULL UNIQUE,
    Email NVARCHAR(120) NULL,
    Phone NVARCHAR(50) NULL,
    PasswordHash NVARCHAR(300) NOT NULL,
    RoleId INT NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

CREATE TABLE Categories (
    Id INT IDENTITY PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    Description NVARCHAR(250) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
);

CREATE TABLE Brands (
    Id INT IDENTITY PRIMARY KEY,
    Name NVARCHAR(120) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
);

CREATE TABLE Products (
    Id INT IDENTITY PRIMARY KEY,
    ProductName NVARCHAR(150) NOT NULL,
    Reference NVARCHAR(80) NULL,
    Description NVARCHAR(300) NULL,
    CategoryId INT NOT NULL,
    BrandId INT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId) REFERENCES Categories(Id),
    CONSTRAINT FK_Products_Brands FOREIGN KEY (BrandId) REFERENCES Brands(Id)
);

CREATE TABLE ProductVariants (
    Id INT IDENTITY PRIMARY KEY,
    ProductId INT NOT NULL,
    SKU NVARCHAR(80) NOT NULL,
    Barcode NVARCHAR(80) NOT NULL UNIQUE,
    Color NVARCHAR(80) NULL,
    Size NVARCHAR(30) NULL,
    PurchasePrice DECIMAL(18,2) NOT NULL,
    SalePrice DECIMAL(18,2) NOT NULL,
    CurrentStock INT NOT NULL,
    MinStock INT NOT NULL DEFAULT 3,
    IsReservable BIT NOT NULL DEFAULT 1,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_ProductVariants_Products FOREIGN KEY (ProductId) REFERENCES Products(Id)
);

CREATE TABLE Customers (
    Id INT IDENTITY PRIMARY KEY,
    FirstName NVARCHAR(80) NOT NULL,
    LastName NVARCHAR(80) NOT NULL,
    Phone NVARCHAR(30) NOT NULL,
    Email NVARCHAR(120) NULL,
    City NVARCHAR(80) NULL,
    VipStatus BIT NOT NULL DEFAULT 0,
    TotalSpentLifetime DECIMAL(18,2) NOT NULL DEFAULT 0,
    TotalSpentCurrentMonth DECIMAL(18,2) NOT NULL DEFAULT 0,
    CurrentCreditAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    IsWhatsAppOptIn BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
);

CREATE TABLE Registers (
    Id INT IDENTITY PRIMARY KEY,
    RegisterName NVARCHAR(80) NOT NULL,
    Location NVARCHAR(120) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
);

CREATE TABLE CashSessions (
    Id INT IDENTITY PRIMARY KEY,
    RegisterId INT NOT NULL,
    OpenedByUserId INT NOT NULL,
    OpeningAmount DECIMAL(18,2) NOT NULL,
    OpenedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ClosedByUserId INT NULL,
    CountedCashAmount DECIMAL(18,2) NULL,
    DifferenceAmount DECIMAL(18,2) NULL,
    ClosedAt DATETIME2 NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'OPEN',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_CashSessions_Registers FOREIGN KEY (RegisterId) REFERENCES Registers(Id),
    CONSTRAINT FK_CashSessions_Users FOREIGN KEY (OpenedByUserId) REFERENCES Users(Id)
);

CREATE TABLE Sales (
    Id INT IDENTITY PRIMARY KEY,
    SaleNumber NVARCHAR(80) NOT NULL UNIQUE,
    UserId INT NOT NULL,
    CustomerId INT NULL,
    CashSessionId INT NULL,
    SaleDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    SubtotalAmount DECIMAL(18,2) NOT NULL,
    DiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    TotalAmount DECIMAL(18,2) NOT NULL,
    PaidAmount DECIMAL(18,2) NOT NULL,
    RemainingAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    SaleStatus NVARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_Sales_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_Sales_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
    CONSTRAINT FK_Sales_CashSessions FOREIGN KEY (CashSessionId) REFERENCES CashSessions(Id)
);

CREATE TABLE SaleLines (
    Id INT IDENTITY PRIMARY KEY,
    SaleId INT NOT NULL,
    ProductVariantId INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    DiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    LineTotal DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_SaleLines_Sales FOREIGN KEY (SaleId) REFERENCES Sales(Id),
    CONSTRAINT FK_SaleLines_ProductVariants FOREIGN KEY (ProductVariantId) REFERENCES ProductVariants(Id)
);

CREATE TABLE SalePayments (
    Id INT IDENTITY PRIMARY KEY,
    SaleId INT NOT NULL,
    PaymentMethod NVARCHAR(30) NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_SalePayments_Sales FOREIGN KEY (SaleId) REFERENCES Sales(Id)
);

CREATE TABLE Reservations (
    Id INT IDENTITY PRIMARY KEY,
    ReservationNumber NVARCHAR(80) NOT NULL UNIQUE,
    CustomerId INT NOT NULL,
    CreatedByUserId INT NOT NULL,
    ReservationDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    DueDate DATETIME2 NOT NULL,
    DepositAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    TotalAmount DECIMAL(18,2) NOT NULL,
    RemainingAmount DECIMAL(18,2) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'RESERVED',
    ReminderSent BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_Reservations_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
    CONSTRAINT FK_Reservations_Users FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
);

CREATE TABLE ReservationItems (
    Id INT IDENTITY PRIMARY KEY,
    ReservationId INT NOT NULL,
    ProductVariantId INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    LineTotal DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL,
    CONSTRAINT FK_ReservationItems_Reservations FOREIGN KEY (ReservationId) REFERENCES Reservations(Id),
    CONSTRAINT FK_ReservationItems_ProductVariants FOREIGN KEY (ProductVariantId) REFERENCES ProductVariants(Id)
);

INSERT INTO Roles(Name, Description) VALUES
('ADMIN', 'Administrateur'),
('EMPLOYE', 'Employé');

INSERT INTO Categories(Name) VALUES ('Robes'), ('Chaussures'), ('Sacs');
INSERT INTO Brands(Name) VALUES ('Trésor Collection');
INSERT INTO Registers(RegisterName, Location) VALUES ('Caisse principale', 'Boutique');

-- =========================================================
-- SplitWork App Database Schema
-- Run this in SSMS (SQL Server Management Studio)
-- =========================================================

-- 1. Create the database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'SplitWorkDB')
BEGIN
    CREATE DATABASE SplitWorkDB;
END
GO

USE SplitWorkDB;
GO

-- =========================================================
-- 2. Split Money tables
-- =========================================================

IF OBJECT_ID('dbo.SplitParticipants', 'U') IS NOT NULL DROP TABLE dbo.SplitParticipants;
IF OBJECT_ID('dbo.SplitGroups', 'U') IS NOT NULL DROP TABLE dbo.SplitGroups;
GO

CREATE TABLE SplitGroups (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    Title           NVARCHAR(200)   NOT NULL DEFAULT 'Untitled Split',
    TotalAmount     DECIMAL(10, 2)  NOT NULL,
    NumberOfPeople  INT             NOT NULL,
    CreatedAt       DATETIME        NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE SplitParticipants (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    SplitGroupId  INT             NOT NULL FOREIGN KEY REFERENCES SplitGroups(Id) ON DELETE CASCADE,
    Name          NVARCHAR(100)   NOT NULL,
    AmountOwed    DECIMAL(10, 2)  NOT NULL,
    Paid          BIT             NOT NULL DEFAULT 0
);
GO

-- =========================================================
-- 3. Work Schedule table
-- =========================================================

IF OBJECT_ID('dbo.WorkSchedules', 'U') IS NOT NULL DROP TABLE dbo.WorkSchedules;
GO

CREATE TABLE WorkSchedules (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeName  NVARCHAR(100)  NOT NULL,
    WorkDate      DATE           NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    ClockIn       DATETIME       NULL,
    ClockOut      DATETIME       NULL,
    Notes         NVARCHAR(500)  NULL
);
GO

-- =========================================================
-- 4. (Optional) Sample data for quick testing
-- =========================================================

-- INSERT INTO SplitGroups (Title, TotalAmount, NumberOfPeople) VALUES ('Dinner at Cafe', 1200, 4);
-- INSERT INTO SplitParticipants (SplitGroupId, Name, AmountOwed, Paid) VALUES (1, 'Alice', 300, 0);

PRINT 'SplitWorkDB schema created successfully.';

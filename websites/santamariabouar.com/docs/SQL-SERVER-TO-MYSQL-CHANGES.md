# SQL Server to MySQL Service Changes

## Key Differences

### 1. Import Statement
```typescript
// SQL Server
import * as sql from 'mssql';

// MySQL
import * as mysql from 'mysql2/promise';
```

### 2. Connection Method
```typescript
// SQL Server
const pool = await db.getConnection();
const result = await pool.request()
  .input('param', sql.Int, value)
  .query('SELECT * FROM table WHERE id = @param');

// MySQL  
const [rows] = await db.query('SELECT * FROM table WHERE id = ?', [value]);
```

### 3. Parameter Placeholders
- SQL Server: `@paramName`
- MySQL: `?` (positional)

### 4. Data Type Conversions
```typescript
// SQL Server
.input('name', sql.NVarChar, value)
.input('id', sql.Int, value)
.input('amount', sql.Decimal(18, 2), value)
.input('active', sql.Bit, value)

// MySQL
// No type specification needed - just pass values in array
[value1, value2, value3]
```

### 5. Date Formatting
```typescript
// SQL Server
CONVERT(VARCHAR, created_at, 127) as createdAt

// MySQL
DATE_FORMAT(created_at, '%Y-%m-%dT%TZ') as createdAt
// OR just return the datetime and let JS handle it
created_at as createdAt
```

### 6. Boolean Values
```typescript
// SQL Server
is_active BIT

// MySQL  
is_active BOOLEAN (internally TINYINT)
// Pass as: value ? 1 : 0
```

### 7. Query Results
```typescript
// SQL Server
const result = await pool.request().query(sql);
return result.recordset; // array of rows

// MySQL
const [rows, fields] = await db.query(sql, params);
return rows; // array of rows
```

### 8. INSERT with OUTPUT (SQL Server) vs INSERT (MySQL)
```typescript
// SQL Server
INSERT INTO table (col1) 
OUTPUT INSERTED.id, INSERTED.col1
VALUES (@val1)

// MySQL - Get last insert ID
INSERT INTO table (col1) VALUES (?)
// Then:
const [result] = await db.query(insertSql, [val1]);
const insertId = result.insertId;
// Followed by SELECT to get the full record
const [rows] = await db.query('SELECT * FROM table WHERE id = ?', [insertId]);
return rows[0];
```



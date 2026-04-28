#!/usr/bin/env python3
"""
Setup de datos iniciales para el módulo de Vacaciones (Leave)
Poblará las tablas con tipos de licencia estándar y festivos iniciales

Ejecución:
    cd erp_zoro_python
    python populate_leave_data.py
"""

import sys
import os
from datetime import datetime

# Agregar el directorio actual al path para importar app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.db.session import get_connection
except ModuleNotFoundError:
    # Fallback: usar conexión directa a SQL Server
    print("⚠️  No se pudo importar app.db.session, usando conexión directa...")
    import pyodbc
    
    def get_connection():
        """Crear conexión directa a SQL Server"""
        conn_str = (
            'Driver={ODBC Driver 17 for SQL Server};'
            'Server=74.208.195.73,1433;'
            'Database=ERP_Zoro;'
            'UID=sa;'
            'PWD=Zoro2024!.;'
        )
        try:
            return pyodbc.connect(conn_str)
        except Exception as e:
            print(f"Error conectando con ODBC Driver 17: {e}")
            # Intentar con Driver 18
            conn_str = conn_str.replace('ODBC Driver 17 for SQL Server', 'ODBC Driver 18 for SQL Server')
            return pyodbc.connect(conn_str)

def populate_leave_types():
    """Populate ERP_HR_LEAVE_TYPES with standard leave types"""
    
    print("\n" + "="*70)
    print("POBLANDO TIPOS DE LICENCIA")
    print("="*70)
    
    leave_types = [
        {
            'name': 'Vacaciones',
            'description': 'Días de vacaciones regulares para descanso',
            'color': '#10b981',  # Green
            'default_days': 15,
            'requires_document': False
        },
        {
            'name': 'Enfermedad',
            'description': 'Licencia por enfermedad o incapacidad médica',
            'color': '#ef4444',  # Red
            'default_days': 5,
            'requires_document': True
        },
        {
            'name': 'Licencia Personal',
            'description': 'Licencia personal sin especificar motivo',
            'color': '#f59e0b',  # Amber
            'default_days': 3,
            'requires_document': False
        },
        {
            'name': 'Maternidad/Paternidad',
            'description': 'Licencia por maternidad o paternidad',
            'color': '#8b5cf6',  # Purple
            'default_days': 30,
            'requires_document': True
        },
        {
            'name': 'Capacitación',
            'description': 'Días para asistir a capacitación laboral',
            'color': '#3b82f6',  # Blue
            'default_days': 7,
            'requires_document': False
        },
        {
            'name': 'Luto',
            'description': 'Licencia por fallecimiento de familiar',
            'color': '#6b7280',  # Gray
            'default_days': 5,
            'requires_document': True
        }
    ]
    
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Obtener company_id = 1 (la compañía por defecto)
            company_id = 1
            
            inserted_count = 0
            skipped_count = 0
            
            for leave_type in leave_types:
                try:
                    # Verificar si ya existe
                    cursor.execute(
                        "SELECT LeaveType_Id FROM ERP_HR_LEAVE_TYPES WHERE Name = ? AND Company_Id = ?",
                        (leave_type['name'], company_id)
                    )
                    
                    if cursor.fetchone():
                        print(f"  ⊘ {leave_type['name']} - Ya existe")
                        skipped_count += 1
                        continue
                    
                    # Insertar nuevo tipo
                    cursor.execute(
                        """
                        INSERT INTO ERP_HR_LEAVE_TYPES 
                        (Company_Id, Name, Description, Color, DefaultDays, Requires_Document, IsActive, CreatedAt, UpdatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
                        """,
                        (
                            company_id,
                            leave_type['name'],
                            leave_type['description'],
                            leave_type['color'],
                            leave_type['default_days'],
                            leave_type['requires_document'],
                            True
                        )
                    )
                    
                    print(f"  ✅ {leave_type['name']} - Creado ({leave_type['default_days']} días por defecto)")
                    inserted_count += 1
                    
                except Exception as e:
                    print(f"  ❌ Error insertando {leave_type['name']}: {str(e)}")
            
            conn.commit()
            print(f"\n✅ {inserted_count} tipos de licencia insertados")
            print(f"⊘ {skipped_count} tipos ya existentes")
        
    except Exception as e:
        print(f"\n❌ Error conectando a la base de datos: {str(e)}")
        return False
    
    return True


def populate_public_holidays():
    """Populate ERP_COMPANY_PUBLIC_HOLIDAYS with standard holidays"""
    
    print("\n" + "="*70)
    print("POBLANDO DÍAS FESTIVOS")
    print("="*70)
    
    current_year = datetime.now().year
    
    holidays = [
        {'month': 1, 'day': 1, 'name': 'Año Nuevo', 'recurring': True},
        {'month': 5, 'day': 1, 'name': 'Día del Trabajador', 'recurring': True},
        {'month': 12, 'day': 25, 'name': 'Navidad', 'recurring': True},
        {'month': 12, 'day': 31, 'name': 'Fin de Año', 'recurring': True},
    ]
    
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            company_id = 1
            inserted_count = 0
            skipped_count = 0
            
            for holiday in holidays:
                try:
                    # Crear fecha del festivo
                    holiday_date = f"{current_year:04d}-{holiday['month']:02d}-{holiday['day']:02d}"
                    
                    # Verificar si ya existe
                    cursor.execute(
                        "SELECT Holiday_Id FROM ERP_COMPANY_PUBLIC_HOLIDAYS WHERE HolidayDate = ? AND Company_Id = ?",
                        (holiday_date, company_id)
                    )
                    
                    if cursor.fetchone():
                        print(f"  ⊘ {holiday['name']} ({holiday_date}) - Ya existe")
                        skipped_count += 1
                        continue
                    
                    # Insertar nuevo festivo
                    cursor.execute(
                        """
                        INSERT INTO ERP_COMPANY_PUBLIC_HOLIDAYS 
                        (Company_Id, HolidayDate, Name, Description, IsObligatory, IsRecurring, RecurringMonth, RecurringDay, CreatedAt, UpdatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
                        """,
                        (
                            company_id,
                            holiday_date,
                            holiday['name'],
                            f"Festivo: {holiday['name']}",
                            True,
                            holiday['recurring'],
                            holiday['month'] if holiday['recurring'] else None,
                            holiday['day'] if holiday['recurring'] else None
                        )
                    )
                    
                    print(f"  ✅ {holiday['name']} ({holiday_date}) - Creado")
                    inserted_count += 1
                    
                except Exception as e:
                    print(f"  ❌ Error insertando {holiday['name']}: {str(e)}")
            
            conn.commit()
            print(f"\n✅ {inserted_count} festivos insertados")
            print(f"⊘ {skipped_count} festivos ya existentes")
        
    except Exception as e:
        print(f"\n❌ Error conectando a la base de datos: {str(e)}")
        return False
    
    return True


def populate_leave_balances():
    """Populate ERP_HR_LEAVE_BALANCE with initial balances for users"""
    
    print("\n" + "="*70)
    print("POBLANDO SALDOS INICIALES")
    print("="*70)
    
    current_year = datetime.now().year
    
    try:
        with get_connection() as conn:
            cursor = conn.connection.cursor()
            
            # Obtener todos los usuarios activos
            cursor.execute("""
                SELECT DISTINCT u.User_Id, u.Name, u.Lastname
                FROM ERP_USERS u
                WHERE u.IsActive = 1 
                AND u.User_Id > 1  -- Excluir SuperAdmin
                ORDER BY u.User_Id
            """)
            
            users = cursor.fetchall()
            
            if not users:
                print("  ⚠️  No hay usuarios para crear saldos")
                return True
            
            # Obtener todos los tipos de licencia
            cursor.execute("""
                SELECT LeaveType_Id, DefaultDays
                FROM ERP_HR_LEAVE_TYPES
                WHERE IsActive = 1
            """)
            
            leave_types = cursor.fetchall()
            
            if not leave_types:
                print("  ⚠️  No hay tipos de licencia disponibles")
                return True
            
            inserted_count = 0
            skipped_count = 0
            
            for user in users:
                user_id, first_name, last_name = user
                
                for leave_type in leave_types:
                    leave_type_id, default_days = leave_type
                    
                    try:
                        # Verificar si ya existe el saldo
                        cursor.execute(
                            """
                            SELECT Balance_Id FROM ERP_HR_LEAVE_BALANCE 
                            WHERE User_Id = ? AND LeaveType_Id = ? AND Year = ?
                            """,
                            (user_id, leave_type_id, current_year)
                        )
                        
                        if cursor.fetchone():
                            skipped_count += 1
                            continue
                        
                        # Insertar nuevo saldo
                        cursor.execute(
                            """
                            INSERT INTO ERP_HR_LEAVE_BALANCE 
                            (User_Id, LeaveType_Id, Year, AvailableDays, UsedDays, PlannedDays, 
                             CarryOverDays, NegativeBalanceAllowed, CreatedAt, UpdatedAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
                            """,
                            (
                                user_id,
                                leave_type_id,
                                current_year,
                                default_days,  # AvailableDays = DefaultDays
                                0,  # UsedDays = 0 (newly created)
                                0,  # PlannedDays = 0
                                0,  # CarryOverDays = 0
                                False  # NegativeBalanceAllowed = False
                            )
                        )
                        
                        inserted_count += 1
                        
                    except Exception as e:
                        print(f"  ❌ Error para usuario {first_name} {last_name}: {str(e)}")
            
            conn.commit()
            
            total_users = len(users)
            total_types = len(leave_types)
            print(f"\n✅ {inserted_count} saldos iniciales creados")
            print(f"   ({total_users} usuarios × {total_types} tipos de licencia)")
            print(f"⊘ {skipped_count} saldos ya existentes")
        
    except Exception as e:
        print(f"\n❌ Error conectando a la base de datos: {str(e)}")
        return False
    
    return True


def main():
    """Main execution"""
    
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " "*15 + "SCRIPT DE POBLACIÓN DE DATOS - MÓDULO VACACIONES" + " "*5 + "║")
    print("╚" + "="*68 + "╝")
    
    # Ejecutar poblaciones
    success = True
    
    if not populate_leave_types():
        success = False
    
    if not populate_public_holidays():
        success = False
    
    if not populate_leave_balances():
        success = False
    
    # Resumen final
    print("\n" + "="*70)
    if success:
        print("✅ POBLACIÓN DE DATOS COMPLETADA EXITOSAMENTE")
    else:
        print("❌ POBLACIÓN DE DATOS COMPLETADA CON ERRORES")
    print("="*70 + "\n")
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())

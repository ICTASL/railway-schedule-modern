-- A least-privilege MySQL account for this app. NOT executed by the project: review, then run it
-- yourself as an administrator (e.g. `mysql -u root -p < db/readonly-user.sql`).
--
-- The app only ever reads these tables. It never needs (and must not get) access to tbl_users,
-- tbl_user_perms, tbl_role_*, tbl_perm_data or ci_sessions, which hold admin accounts and sessions.
--
-- Replace CHANGE_ME with a strong password and use it in DATABASE_URL, e.g.
--   DATABASE_URL=mysql://slr_search:<password>@localhost:3306/railway

CREATE USER IF NOT EXISTS 'slr_search'@'localhost' IDENTIFIED BY 'CHANGE_ME';

GRANT SELECT ON railway.tbl_stationdetail          TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_trainline_station      TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_train                  TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_type                   TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_frequancy              TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_frequency_date         TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_date                   TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_train_timetable        TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_train_timetable_detail TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_train_class            TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_classtype              TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_train_connect_detail   TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_connecting_train       TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_station_distance       TO 'slr_search'@'localhost';
GRANT SELECT ON railway.tbl_station_price          TO 'slr_search'@'localhost';

FLUSH PRIVILEGES;

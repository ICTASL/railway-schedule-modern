-- OPTIONAL. Not executed by the project and not required for the app to work.
--
-- Some columns the search filters by have no index in the CMS schema, so MySQL scans the table.
-- At today's data size a search takes roughly 0.2 s; these indexes would bring it well below that.
-- They do not change any data and the CMS (which shares this database) is unaffected, but they
-- are schema changes, so try them on a copy first and take a backup.

-- Stops of a timetable are fetched by timetable id (71k rows scanned today).
ALTER TABLE tbl_train_timetable_detail ADD INDEX idx_ttdetail_ttid (TTID);

-- Distance and price lookups by station pair / distance id (113k and 232k rows scanned today).
ALTER TABLE tbl_station_distance ADD INDEX idx_stdist_pair (FromStID, ToStID);
ALTER TABLE tbl_station_price    ADD INDEX idx_stprice_disid (StDisID);

-- Connection chains are looked up by timetable id and chain id.
ALTER TABLE tbl_train_connect_detail ADD INDEX idx_tcdetail_ttid (TTID), ADD INDEX idx_tcdetail_contid (ConTID);

-- OnMyWay · 0006 · advisor fix: pin search_path on the constant helpers from 0003.
alter function private.max_batch()        set search_path = '';
alter function private.max_open_orders()  set search_path = '';
alter function private.pin_ttl()          set search_path = '';
alter function private.pin_max_attempts() set search_path = '';
alter function private.stale_after()      set search_path = '';

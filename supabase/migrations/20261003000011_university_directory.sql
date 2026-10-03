-- =============================================================================
-- Initial university directory.
--
-- *.ac.jp domains not listed here still work: they get an auto-created group
-- named after the domain until an admin confirms the official name.
-- Review/extend this list from the admin console (大学管理) before launch.
-- =============================================================================

-- Institute of Science Tokyo already has its own service (TextNext for ISCT).
-- Sign-ups from these domains are redirected there instead of creating a group.
with isct as (
  insert into public.universities (slug, name, short_name, status, external_url, name_verified)
  values ('isct', '東京科学大学', '科学大', 'external', 'https://textnext.jp', true)
  returning id
)
insert into public.university_domains (domain, university_id, include_subdomains)
select d, isct.id, true
from isct, unnest(array['isct.ac.jp', 'titech.ac.jp', 'tmd.ac.jp']) as d;

with directory (slug, name, short_name, domains) as (
  values
    ('u-tokyo',     '東京大学',         '東大',   array['u-tokyo.ac.jp']),
    ('kyoto-u',     '京都大学',         '京大',   array['kyoto-u.ac.jp']),
    ('osaka-u',     '大阪大学',         '阪大',   array['osaka-u.ac.jp']),
    ('tohoku',      '東北大学',         '東北大', array['tohoku.ac.jp']),
    ('nagoya-u',    '名古屋大学',       '名大',   array['nagoya-u.ac.jp']),
    ('kyushu-u',    '九州大学',         '九大',   array['kyushu-u.ac.jp']),
    ('hokudai',     '北海道大学',       '北大',   array['hokudai.ac.jp']),
    ('hit-u',       '一橋大学',         '一橋',   array['hit-u.ac.jp']),
    ('tsukuba',     '筑波大学',         '筑波大', array['tsukuba.ac.jp']),
    ('kobe-u',      '神戸大学',         '神大',   array['kobe-u.ac.jp']),
    ('chiba-u',     '千葉大学',         '千葉大', array['chiba-u.jp', 'chiba-u.ac.jp']),
    ('ynu',         '横浜国立大学',     '横国',   array['ynu.ac.jp']),
    ('tuat',        '東京農工大学',     '農工大', array['tuat.ac.jp']),
    ('uec',         '電気通信大学',     '電通大', array['uec.ac.jp']),
    ('hiroshima-u', '広島大学',         '広大',   array['hiroshima-u.ac.jp']),
    ('keio',        '慶應義塾大学',     '慶應',   array['keio.jp', 'keio.ac.jp']),
    ('waseda',      '早稲田大学',       '早稲田', array['waseda.jp']),
    ('sophia',      '上智大学',         '上智',   array['sophia.ac.jp']),
    ('meiji',       '明治大学',         '明治',   array['meiji.ac.jp']),
    ('tus',         '東京理科大学',     '理科大', array['tus.ac.jp'])
),
inserted as (
  insert into public.universities (slug, name, short_name, name_verified)
  select slug, name, short_name, true from directory
  returning id, slug
)
insert into public.university_domains (domain, university_id, include_subdomains)
select d, i.id, true
from inserted i
join directory dir on dir.slug = i.slug
cross join lateral unnest(dir.domains) as d;

select private.seed_default_spots(u.id)
from public.universities u
where u.status = 'active';

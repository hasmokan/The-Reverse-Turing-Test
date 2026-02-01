-- Project Mimic 数据库 Schema
-- 使用方式: psql -d mimic -f schema.sql

-- 主题配置表
CREATE TABLE IF NOT EXISTS themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id VARCHAR(50) UNIQUE NOT NULL,
    theme_name VARCHAR(100) NOT NULL,
    background_url TEXT NOT NULL,
    particle_effect VARCHAR(50),
    palette JSONB NOT NULL,
    ai_keywords JSONB NOT NULL,
    ai_prompt_style TEXT NOT NULL,
    spawn_rate INT DEFAULT 5,
    max_imposters INT DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 房间表
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES themes(id) NOT NULL,
    room_code VARCHAR(10) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    total_items INT DEFAULT 0,
    ai_count INT DEFAULT 0,
    online_count INT DEFAULT 0,
    turbidity FLOAT DEFAULT 0.0,
    voting_started_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 绘画作品表
CREATE TABLE IF NOT EXISTS drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    is_ai BOOLEAN DEFAULT FALSE,
    image_data TEXT NOT NULL,
    name VARCHAR(24) NOT NULL,
    description VARCHAR(60),
    author_name VARCHAR(50) DEFAULT '匿名艺术家',
    position_x FLOAT DEFAULT 0.5,
    position_y FLOAT DEFAULT 0.5,
    velocity_x FLOAT DEFAULT 0.0,
    velocity_y FLOAT DEFAULT 0.0,
    rotation FLOAT DEFAULT 0.0,
    scale FLOAT DEFAULT 1.0,
    flip_x BOOLEAN DEFAULT FALSE,
    vote_count INT DEFAULT 0,
    is_eliminated BOOLEAN DEFAULT FALSE,
    eliminated_at TIMESTAMPTZ,
    report_count INT DEFAULT 0,
    is_hidden BOOLEAN DEFAULT FALSE,
    session_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投票记录表
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID REFERENCES drawings(id) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(drawing_id, session_id)
);

-- 举报记录表
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID REFERENCES drawings(id) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(drawing_id, session_id)
);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID REFERENCES drawings(id) NOT NULL,
    author VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI 生成任务表
CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    drawing_id UUID REFERENCES drawings(id),
    status VARCHAR(20) DEFAULT 'pending',
    n8n_execution_id VARCHAR(100),
    prompt TEXT,
    keyword VARCHAR(50),
    image_data TEXT,
    generated_name VARCHAR(24),
    generated_description VARCHAR(60),
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS human_fish (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_data TEXT NOT NULL,
    difficulty_level INT NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    weight INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_fish (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_data TEXT NOT NULL,
    difficulty_level INT NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    weight INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS single_player_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL,
    theme_id UUID REFERENCES themes(id),
    level INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    max_mistakes INT NOT NULL DEFAULT 3,
    mistakes INT NOT NULL DEFAULT 0,
    target_total INT NOT NULL DEFAULT 3,
    targets_found INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS single_player_run_fish (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES single_player_runs(id) NOT NULL,
    fish_kind VARCHAR(10) NOT NULL,
    fish_id UUID NOT NULL,
    order_index INT NOT NULL,
    is_caught BOOLEAN NOT NULL DEFAULT FALSE,
    caught_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS single_player_catches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES single_player_runs(id) NOT NULL,
    run_fish_id UUID REFERENCES single_player_run_fish(id) NOT NULL,
    correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 账号体系（预留网站 + 小程序）
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    appid VARCHAR(64),
    openid VARCHAR(128),
    unionid VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, appid, openid)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_unionid_unique
    ON auth_identities(provider, unionid)
    WHERE unionid IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id UUID REFERENCES users(id) NOT NULL,
    legacy_session_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- 索引
CREATE INDEX IF NOT EXISTS idx_rooms_theme ON rooms(theme_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_drawings_room ON drawings(room_id);
CREATE INDEX IF NOT EXISTS idx_drawings_room_active ON drawings(room_id) 
    WHERE is_eliminated = FALSE AND is_hidden = FALSE;
CREATE INDEX IF NOT EXISTS idx_votes_drawing ON votes(drawing_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_room ON ai_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_human_fish_active_level ON human_fish(is_active, difficulty_level);
CREATE INDEX IF NOT EXISTS idx_ai_fish_active_level ON ai_fish(is_active, difficulty_level);
CREATE INDEX IF NOT EXISTS idx_sp_runs_session ON single_player_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_sp_run_fish_run ON single_player_run_fish(run_id);
CREATE INDEX IF NOT EXISTS idx_sp_catches_run ON single_player_catches(run_id);

-- 初始主题数据
INSERT INTO themes (theme_id, theme_name, background_url, particle_effect, palette, ai_keywords, ai_prompt_style, spawn_rate, max_imposters)
VALUES 
    ('fish_tank_01', '深海鱼缸', '/backgrounds/fish-tank.svg', 'bubbles',
     '["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"]'::jsonb,
     '["fish", "whale", "shark", "octopus", "jellyfish", "crab"]'::jsonb,
     'children''s drawing, scribble, thick marker lines, wobbly lines, MS paint style, no shading, flat color',
     5, 5),
    ('cafe_01', '混乱咖啡厅', '/backgrounds/cafe.svg', 'steam',
     '["#6F4E37", "#FFFFFF", "#000000", "#D4A574", "#8B4513"]'::jsonb,
     '["coffee cup", "croissant", "donut", "spoon", "cake"]'::jsonb,
     'drawn on a napkin, messy ink, children''s drawing, wobbly lines',
     5, 5)
ON CONFLICT (theme_id) DO NOTHING;

INSERT INTO human_fish (id, image_data, difficulty_level, metadata, weight, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000101', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 1, '{"authorName":"小明","createDate":"2024-05-20","description":"一只蓝色的鱼"}'::jsonb, 3, TRUE),
    ('00000000-0000-0000-0000-000000000102', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 1, '{"authorName":"阿强","createDate":"2024-06-01","description":"随便画画的小鱼"}'::jsonb, 1, TRUE),
    ('00000000-0000-0000-0000-000000000103', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 1, '{"authorName":"花花","createDate":"2024-06-10","description":"好难画啊"}'::jsonb, 1, TRUE),
    ('00000000-0000-0000-0000-000000000201', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 2, '{"authorName":"小红","createDate":"2024-07-01","description":"一条看起来很正常的鱼"}'::jsonb, 2, TRUE),
    ('00000000-0000-0000-0000-000000000202', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 2, '{"authorName":"大雄","createDate":"2024-07-02","description":"我觉得还行"}'::jsonb, 1, TRUE),
    ('00000000-0000-0000-0000-000000000203', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 2, '{"authorName":"静香","createDate":"2024-07-03","description":"鱼鱼鱼"}'::jsonb, 1, TRUE),
    ('00000000-0000-0000-0000-000000000301', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 3, '{"authorName":"老王","createDate":"2024-08-01","description":"画得有点乱但是真的"}'::jsonb, 2, TRUE),
    ('00000000-0000-0000-0000-000000000302', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 3, '{"authorName":"小李","createDate":"2024-08-02","description":"这是我画的"}'::jsonb, 1, TRUE),
    ('00000000-0000-0000-0000-000000000303', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 3, '{"authorName":"建国","createDate":"2024-08-03","description":"感觉还不错"}'::jsonb, 1, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_fish (id, image_data, difficulty_level, metadata, weight, is_active)
VALUES
    ('00000000-0000-0000-0000-000000001101', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 1, '{"authorName":"Model_v4","createDate":"1800-01-01","description":"对象:鱼 风格:写实"}'::jsonb, 3, TRUE),
    ('00000000-0000-0000-0000-000000001102', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 1, '{"authorName":"[AI]","createDate":"0000-00-00","description":"A fish with normal properties"}'::jsonb, 1, TRUE),
    ('00000000-0000-0000-0000-000000001201', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 2, '{"authorName":"Model_v7","createDate":"2099-12-31","description":"error: cannot resolve fin"}'::jsonb, 2, TRUE),
    ('00000000-0000-0000-0000-000000001202', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 2, '{"authorName":"Model_v7","createDate":"1970-01-01","description":"对象:鱼; 纹理:NA"}'::jsonb, 1, TRUE),
    ('00000000-0000-0000-0000-000000001301', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 3, '{"authorName":"Model_v9","createDate":"9999-99-99","description":"### SYSTEM OUTPUT ###"}'::jsonb, 2, TRUE),
    ('00000000-0000-0000-0000-000000001302', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XK7xkAAAAASUVORK5CYII=', 3, '{"authorName":"Model_v9","createDate":"1800-01-01","description":"(null)"}'::jsonb, 1, TRUE)
ON CONFLICT (id) DO NOTHING;

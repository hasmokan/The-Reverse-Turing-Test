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

-- 索引
CREATE INDEX IF NOT EXISTS idx_rooms_theme ON rooms(theme_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_drawings_room ON drawings(room_id);
CREATE INDEX IF NOT EXISTS idx_drawings_room_active ON drawings(room_id) 
    WHERE is_eliminated = FALSE AND is_hidden = FALSE;
CREATE INDEX IF NOT EXISTS idx_votes_drawing ON votes(drawing_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_room ON ai_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);

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

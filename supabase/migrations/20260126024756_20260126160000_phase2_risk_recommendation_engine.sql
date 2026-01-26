/*
  # Faz 2B: Akıllı Risk Öneri Motoru

  Bu migration, akıllı risk önerilerini otomatik oluşturan fonksiyonlar ekler.

  ## Özellikler
    - Yüksek risk tespiti ve öneri
    - Benzer risklerden öğrenme
    - Gözden geçirme sıklığı önerisi
    - Kontrol etkinliği analizi
    - Tedavi önerileri
*/

-- ═════════════════════════════════════════════════════════════════════════
-- AKILLI ÖNERİ MOTORU FONKSİYONLARI
-- ═════════════════════════════════════════════════════════════════════════

-- 1. Yüksek riskler için tedavi önerisi
CREATE OR REPLACE FUNCTION generate_high_risk_recommendations()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  risk_record RECORD;
  v_similar_risks_count INT;
  v_avg_reduction NUMERIC;
BEGIN
  FOR risk_record IN
    SELECT r.* FROM risks r
    WHERE r.residual_score >= 12
    AND NOT EXISTS (
      SELECT 1 FROM risk_recommendations rr
      WHERE rr.risk_id = r.id
      AND rr.recommendation_type = 'TREATMENT_SUGGESTION'
      AND rr.status = 'PENDING'
      AND rr.created_at >= NOW() - INTERVAL '7 days'
    )
  LOOP
    SELECT 
      COUNT(*),
      AVG(r2.inherent_score - r2.residual_score)
    INTO v_similar_risks_count, v_avg_reduction
    FROM risks r2
    WHERE r2.organization_id = risk_record.organization_id
    AND r2.id != risk_record.id
    AND ABS(r2.inherent_score - risk_record.inherent_score) <= 3
    AND r2.residual_score < 8;
    
    IF v_similar_risks_count > 0 THEN
      INSERT INTO risk_recommendations (
        risk_id, recommendation_type, title, description, rationale,
        suggested_action, expected_benefit, implementation_effort,
        priority, confidence_score, metadata
      ) VALUES (
        risk_record.id,
        'TREATMENT_SUGGESTION',
        'Yüksek Risk - Acil Tedavi Önerisi',
        format('Bu risk yüksek seviyede (%s puan). Benzer %s risk için uygulanan tedbirler ortalama %s puan azaltma sağlamış.',
          risk_record.residual_score,
          v_similar_risks_count,
          ROUND(v_avg_reduction, 1)
        ),
        'Benzer risk profilli kayıtlarda başarılı sonuçlar gözlemlendi',
        'Risk kontrol tedbirlerini güçlendirin ve alternatif risk yanıt stratejileri değerlendirin',
        format('Risk skorunu ortalama %s puan azaltabilir', ROUND(v_avg_reduction, 1)),
        CASE 
          WHEN risk_record.residual_score >= 16 THEN 'HIGH'
          ELSE 'MEDIUM'
        END,
        CASE 
          WHEN risk_record.residual_score >= 16 THEN 'URGENT'
          ELSE 'HIGH'
        END,
        CASE
          WHEN v_similar_risks_count >= 5 THEN 85
          WHEN v_similar_risks_count >= 3 THEN 75
          ELSE 65
        END,
        jsonb_build_object(
          'similar_risks_count', v_similar_risks_count,
          'avg_reduction', v_avg_reduction,
          'current_score', risk_record.residual_score
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- 2. Gözden geçirme sıklığı önerisi
CREATE OR REPLACE FUNCTION generate_review_frequency_recommendations()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  risk_record RECORD;
  v_review_count INT;
  v_score_changes INT;
  v_suggested_frequency VARCHAR(20);
  v_suggested_months INT;
BEGIN
  FOR risk_record IN
    SELECT r.* FROM risks r
    WHERE r.next_review_date IS NOT NULL
  LOOP
    SELECT COUNT(*) INTO v_review_count
    FROM risk_versions
    WHERE risk_id = risk_record.id
    AND created_at >= NOW() - INTERVAL '12 months';
    
    SELECT COUNT(*) INTO v_score_changes
    FROM risk_versions
    WHERE risk_id = risk_record.id
    AND 'residual_score' = ANY(changed_fields)
    AND created_at >= NOW() - INTERVAL '12 months';
    
    IF risk_record.residual_score >= 16 THEN
      v_suggested_frequency := 'MONTHLY';
      v_suggested_months := 1;
    ELSIF risk_record.residual_score >= 12 OR v_score_changes >= 4 THEN
      v_suggested_frequency := 'QUARTERLY';
      v_suggested_months := 3;
    ELSIF risk_record.residual_score >= 8 OR v_score_changes >= 2 THEN
      v_suggested_frequency := 'SEMI_ANNUAL';
      v_suggested_months := 6;
    ELSE
      v_suggested_frequency := 'ANNUAL';
      v_suggested_months := 12;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM risk_recommendations
      WHERE risk_id = risk_record.id
      AND recommendation_type = 'REVIEW_FREQUENCY'
      AND status = 'PENDING'
      AND created_at >= NOW() - INTERVAL '30 days'
    ) THEN
      INSERT INTO risk_recommendations (
        risk_id, recommendation_type, title, description, rationale,
        suggested_action, implementation_effort, priority, confidence_score,
        metadata
      ) VALUES (
        risk_record.id,
        'REVIEW_FREQUENCY',
        'Gözden Geçirme Sıklığı Önerisi',
        format('Bu risk için önerilen gözden geçirme sıklığı: %s (%s ayda bir)',
          v_suggested_frequency, v_suggested_months),
        format('Son 12 ayda %s gözden geçirme yapılmış, %s kez risk skoru değişmiş',
          v_review_count, v_score_changes),
        format('Riski %s ayda bir gözden geçirin', v_suggested_months),
        'LOW',
        CASE 
          WHEN risk_record.residual_score >= 12 THEN 'HIGH'
          ELSE 'MEDIUM'
        END,
        80,
        jsonb_build_object(
          'suggested_frequency', v_suggested_frequency,
          'suggested_months', v_suggested_months,
          'review_count', v_review_count,
          'score_changes', v_score_changes
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- 3. Kontrol etkinliği analizi ve önerisi
CREATE OR REPLACE FUNCTION generate_control_effectiveness_recommendations()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  risk_record RECORD;
  v_control_count INT;
  v_effective_count INT;
  v_effectiveness_rate NUMERIC;
BEGIN
  FOR risk_record IN
    SELECT r.* FROM risks r
    WHERE r.residual_score >= 8
  LOOP
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE effectiveness_rating IN ('EFFECTIVE', 'HIGHLY_EFFECTIVE'))
    INTO v_control_count, v_effective_count
    FROM risk_controls
    WHERE risk_id = risk_record.id;
    
    IF v_control_count = 0 THEN
      INSERT INTO risk_recommendations (
        risk_id, recommendation_type, title, description, rationale,
        suggested_action, implementation_effort, priority, confidence_score
      ) VALUES (
        risk_record.id,
        'CONTROL_SUGGESTION',
        'Kontrol Tedbirleri Eklenmeli',
        'Bu risk için henüz kontrol tedbiri tanımlanmamış',
        'Risk seviyesi orta/yüksek ancak kontrol tedbiri bulunmuyor',
        'Risk için uygun kontrol tedbirleri tanımlayın ve etkinliklerini izleyin',
        'MEDIUM',
        'HIGH',
        90
      );
    ELSIF v_control_count > 0 THEN
      v_effectiveness_rate := (v_effective_count::NUMERIC / v_control_count) * 100;
      
      IF v_effectiveness_rate < 50 AND NOT EXISTS (
        SELECT 1 FROM risk_recommendations
        WHERE risk_id = risk_record.id
        AND recommendation_type = 'CONTROL_SUGGESTION'
        AND status = 'PENDING'
        AND created_at >= NOW() - INTERVAL '30 days'
      ) THEN
        INSERT INTO risk_recommendations (
          risk_id, recommendation_type, title, description, rationale,
          suggested_action, expected_benefit, implementation_effort, priority,
          confidence_score, metadata
        ) VALUES (
          risk_record.id,
          'CONTROL_SUGGESTION',
          'Kontrol Etkinliği Düşük',
          format('Mevcut %s kontrolün sadece %%%s etkin', v_control_count, ROUND(v_effectiveness_rate)),
          'Kontrol tedbirlerinin etkinliği beklenenin altında',
          'Etkisiz kontrolleri gözden geçirin, güçlendirin veya alternatif kontroller ekleyin',
          'Risk skorunu %20-30 azaltabilir',
          'MEDIUM',
          'HIGH',
          75,
          jsonb_build_object(
            'control_count', v_control_count,
            'effective_count', v_effective_count,
            'effectiveness_rate', v_effectiveness_rate
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 4. Risk yanıt stratejisi önerisi
CREATE OR REPLACE FUNCTION generate_risk_response_recommendations()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  risk_record RECORD;
  v_reduction_rate NUMERIC;
  v_suggested_response VARCHAR(20);
BEGIN
  FOR risk_record IN
    SELECT r.* FROM risks r
    WHERE r.inherent_score > 0
  LOOP
    v_reduction_rate := ((risk_record.inherent_score - risk_record.residual_score)::NUMERIC 
                         / risk_record.inherent_score) * 100;
    
    IF risk_record.risk_response = 'ACCEPT' AND risk_record.residual_score >= 12 THEN
      v_suggested_response := 'MITIGATE';
      
      INSERT INTO risk_recommendations (
        risk_id, recommendation_type, title, description, rationale,
        suggested_action, implementation_effort, priority, confidence_score, metadata
      ) VALUES (
        risk_record.id,
        'RISK_RESPONSE_CHANGE',
        'Risk Yanıt Stratejisi Değişikliği Önerisi',
        format('Yüksek risk (%s puan) için KABUL stratejisi uygun değil', risk_record.residual_score),
        'Risk seviyesi organizasyon risk iştahının üzerinde',
        format('Risk yanıt stratejisini %s olarak değiştirin', v_suggested_response),
        'MEDIUM',
        'URGENT',
        85,
        jsonb_build_object(
          'current_response', risk_record.risk_response,
          'suggested_response', v_suggested_response,
          'risk_score', risk_record.residual_score
        )
      ) ON CONFLICT DO NOTHING;
      
    ELSIF risk_record.risk_response = 'MITIGATE' AND v_reduction_rate < 20 
          AND risk_record.residual_score >= 12 THEN
      INSERT INTO risk_recommendations (
        risk_id, recommendation_type, title, description, rationale,
        suggested_action, implementation_effort, priority, confidence_score, metadata
      ) VALUES (
        risk_record.id,
        'RISK_RESPONSE_CHANGE',
        'Risk Azaltma Tedbirleri Yetersiz',
        format('Mevcut tedbirler riski sadece %%%s azalttı', ROUND(v_reduction_rate)),
        'Azaltma stratejisi etkin değil, risk hala yüksek seviyede',
        'Alternatif stratejiler (TRANSFER veya AVOID) değerlendirilmeli',
        'HIGH',
        'HIGH',
        70,
        jsonb_build_object(
          'reduction_rate', v_reduction_rate,
          'risk_score', risk_record.residual_score
        )
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 5. Ana öneri motoru (tüm önerileri çalıştır)
CREATE OR REPLACE FUNCTION generate_all_risk_recommendations()
RETURNS TABLE (
  recommendations_generated INT,
  high_risk_count INT,
  review_frequency_count INT,
  control_effectiveness_count INT,
  response_change_count INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_count INT;
  v_end_count INT;
BEGIN
  SELECT COUNT(*) INTO v_start_count FROM risk_recommendations WHERE status = 'PENDING';
  
  PERFORM generate_high_risk_recommendations();
  SELECT COUNT(*) INTO high_risk_count 
  FROM risk_recommendations 
  WHERE status = 'PENDING' 
  AND recommendation_type = 'TREATMENT_SUGGESTION';
  
  PERFORM generate_review_frequency_recommendations();
  SELECT COUNT(*) INTO review_frequency_count 
  FROM risk_recommendations 
  WHERE status = 'PENDING' 
  AND recommendation_type = 'REVIEW_FREQUENCY';
  
  PERFORM generate_control_effectiveness_recommendations();
  SELECT COUNT(*) INTO control_effectiveness_count 
  FROM risk_recommendations 
  WHERE status = 'PENDING' 
  AND recommendation_type = 'CONTROL_SUGGESTION';
  
  PERFORM generate_risk_response_recommendations();
  SELECT COUNT(*) INTO response_change_count 
  FROM risk_recommendations 
  WHERE status = 'PENDING' 
  AND recommendation_type = 'RISK_RESPONSE_CHANGE';
  
  SELECT COUNT(*) INTO v_end_count FROM risk_recommendations WHERE status = 'PENDING';
  recommendations_generated := v_end_count - v_start_count;
  
  RETURN NEXT;
END;
$$;

-- 6. Süresi dolan önerileri temizle
CREATE OR REPLACE FUNCTION cleanup_expired_recommendations()
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_expired_count INT;
BEGIN
  UPDATE risk_recommendations
  SET is_expired = true,
      status = 'DISMISSED'
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW()
  AND status = 'PENDING'
  AND is_expired = false;
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;
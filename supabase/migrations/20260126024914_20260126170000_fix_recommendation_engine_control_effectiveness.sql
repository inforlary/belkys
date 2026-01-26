/*
  # Faz 2C: Öneri Motoru Düzeltmesi

  Control effectiveness fonksiyonunu mevcut tablo yapısına uygun hale getirir.
*/

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
      COUNT(*) FILTER (WHERE 
        (design_effectiveness IS NOT NULL AND design_effectiveness >= 4) AND
        (operating_effectiveness IS NOT NULL AND operating_effectiveness >= 4)
      )
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
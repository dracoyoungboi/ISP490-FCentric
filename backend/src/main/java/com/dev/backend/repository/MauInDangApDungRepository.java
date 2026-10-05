package com.dev.backend.repository;

import com.dev.backend.entities.MauInDangApDung;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MauInDangApDungRepository extends JpaRepository<MauInDangApDung, String> {
}

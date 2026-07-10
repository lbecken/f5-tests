package dev.syndata.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Root of the exported data file. Tables are stored in insertion (dependency) order.
 */
public class DataSetModel {

    public int version = 1;
    public String generatedAt;
    public Long seed;
    public List<TableDataModel> tables = new ArrayList<>();
}
